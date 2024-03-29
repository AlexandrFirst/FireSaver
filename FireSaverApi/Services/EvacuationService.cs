using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using AutoMapper;
using FireSaverApi.Common;
using FireSaverApi.Contracts;
using FireSaverApi.DataContext;
using FireSaverApi.Dtos.EvacuationPlanDtos;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace FireSaverApi.Services
{
    public class EvacuationService : IEvacuationService
    {
        private readonly DatabaseContext dataContext;
        private readonly IMapper mapper;
        private readonly ICompartmentHelper compartmentHelper;
        private readonly IPlanImageUploadService planImageUploadService;
        private readonly ICompartmentDataCloudinaryService dataCompartmentCloudinaryService;
        private readonly IEvacuationServiceHelper evacServiceHelper;
        private readonly CompartmentDataStorage compartmentDataStorage;

        public EvacuationService(DatabaseContext dataContext,
                                 IMapper mapper,
                                 ICompartmentHelper compartmentHelper,
                                 IPlanImageUploadService planImageCloudinaryService,
                                 ICompartmentDataCloudinaryService dataCompartmentCloudinaryService,
                                 IEvacuationServiceHelper evacServiceHelper,
                                 IUserHelper userHelper,
                                 CompartmentDataStorage compartmentDataStorage)
        {
            this.dataContext = dataContext;
            this.mapper = mapper;
            this.compartmentHelper = compartmentHelper;
            this.planImageUploadService = planImageCloudinaryService;
            this.dataCompartmentCloudinaryService = dataCompartmentCloudinaryService;
            this.evacServiceHelper = evacServiceHelper;
            this.compartmentDataStorage = compartmentDataStorage;
        }

        public async Task<EvacuationPlanDto> addEvacuationPlanToCompartment(int compartmentId, IFormFile planImage)
        {
            var compartment = await compartmentHelper.GetCompartmentById(compartmentId);
            if (compartment.EvacuationPlan != null)
            {
                throw new Exception("Plan is already added");
            }

            var uploadPlanResponse = await planImageUploadService.UploadPlanImage(planImage);

            var newEvacPlan = new EvacuationPlan()
            {
                PublicId = uploadPlanResponse.PublicId,
                Url = uploadPlanResponse.Url,
                Height = uploadPlanResponse.Height,
                Width = uploadPlanResponse.Width,
                UploadTime = DateTime.Now,
                Compartment = compartment,
                ScaleModel = new ScaleModel()
            };

            ImageParser imageParser = new ImageParser(planImage.OpenReadStream());
            ImagePointArray imagePoints = imageParser.ParseImage();


            string publicId = await dataCompartmentCloudinaryService.UploadFile(imagePoints);
            compartment.CompartmentPointsDataPublicId = publicId;

            dataContext.Update(compartment);

            await dataContext.EvacuationPlans.AddAsync(newEvacPlan);
            await dataContext.SaveChangesAsync();

            return mapper.Map<EvacuationPlanDto>(newEvacPlan);
        }

        public async Task<EvacuationPlanDto> changeEvacuationPlanOfCompartment(int compartmentId, IFormFile planImage)
        {
            var compartment = await compartmentHelper.GetCompartmentById(compartmentId);
            var uploadPlanResponse = await planImageUploadService.UploadPlanImage(planImage);
            var evacPlan = compartment.EvacuationPlan;
            await planImageUploadService.DeletePlanImage(evacPlan.PublicId);

            ImageParser imageParser = new ImageParser(planImage.OpenReadStream());
            ImagePointArray imagePoints = imageParser.ParseImage();
            var newPublicId = await dataCompartmentCloudinaryService.UpdateFile(imagePoints, compartment.CompartmentPointsDataPublicId);

            compartment.CompartmentPointsDataPublicId = newPublicId;
            dataContext.Compartment.Update(compartment);

            evacPlan.PublicId = uploadPlanResponse.PublicId;
            evacPlan.Url = uploadPlanResponse.Url;
            evacPlan.UploadTime = DateTime.Now;

            dataContext.EvacuationPlans.Update(evacPlan);
            await dataContext.SaveChangesAsync();

            return mapper.Map<EvacuationPlanDto>(evacPlan);
        }

        public async Task<EvacuationPlanDto> GetEvacuationPlanOfCompartment(int compartmentId)
        {
            var compartment = await compartmentHelper.GetCompartmentById(compartmentId);
            var evacPlan = compartment.EvacuationPlan;

            // compartmentDataStorage.LoadData(compartmentId,
            //     await dataCompartmentCloudinaryService.GetCompartmentData(compartment.CompartmentPointsDataPublicId));
            
            return mapper.Map<EvacuationPlanDto>(evacPlan);
        }

        public async Task RemoveEvacuationPlanOfCompartment(int compartmentId)
        {
            var compartment = await compartmentHelper.GetCompartmentById(compartmentId);
            var evacPlan = compartment.EvacuationPlan;

            compartmentDataStorage.RemoveCompartmentData(compartmentId);

            if (evacPlan != null && evacPlan.PublicId != null)
                await planImageUploadService.DeletePlanImage(evacPlan.PublicId);

            if (compartment.CompartmentPointsDataPublicId is not null)
                await dataCompartmentCloudinaryService.DestroyFile(compartment.CompartmentPointsDataPublicId);

            dataContext.EvacuationPlans.Remove(evacPlan);
            await dataContext.SaveChangesAsync();
        }

        public async Task<List<EvacuationPlanDto>> GetEvacuationPlansFromCompartmentByUserId(int userId)
        {
            var currentUser = await dataContext.Users.Include(c => c.CurrentCompartment)
                                                     .ThenInclude(e => e.EvacuationPlan)
                                                     .FirstOrDefaultAsync(u => u.Id == userId);

            if (currentUser.CurrentCompartment == null)
                throw new Exception("The current compartment is not specified");

            return await GetEvacuationPlansFromCompartment(currentUser.CurrentCompartment);
        }

        public async Task<List<EvacuationPlanDto>> GetEvacuationPlansFromCompartmentByCompartmentId(int compartmentId)
        {
            var currentCompartment = await dataContext.Compartment.Include(e => e.EvacuationPlan).FirstOrDefaultAsync(u => u.Id == compartmentId);
            return await GetEvacuationPlansFromCompartment(currentCompartment);
        }


        private async Task<List<EvacuationPlanDto>> GetEvacuationPlansFromCompartment(Compartment currentCompartment)
        {
            List<EvacuationPlan> result = new List<EvacuationPlan>();
            result.Add(currentCompartment.EvacuationPlan);


            if (currentCompartment.GetType() == typeof(Room))
            {
                var attached = await dataContext.Floors.Include(f => f.BuildingWithThisFloor)
                                                     .Include(r => r.Rooms)
                                                     .Include(ev => ev.EvacuationPlan)
                                                     .FirstOrDefaultAsync(f => f.Rooms.Any(r => r.Id == currentCompartment.Id));

                result.Add(attached.EvacuationPlan);

                var restFloorsEvacPlans = await GetFloorsBelowLevel(attached.Level);

                result.AddRange(restFloorsEvacPlans);
            }
            else
            {
                var restFloorsEvacPlans = await GetFloorsBelowLevel((currentCompartment as Floor).Level);

                result.AddRange(restFloorsEvacPlans);
            }

            // foreach (var c in result)
            // {
            //     compartmentDataStorage.LoadData(c.Compartment.Id,
            //         await dataCompartmentCloudinaryService.GetCompartmentData(c.Compartment.CompartmentPointsDataPublicId));
            // }

            return mapper.Map<List<EvacuationPlanDto>>(result);
        }

        private async Task<List<EvacuationPlan>> GetFloorsBelowLevel(int level)
        {
            var restFloorsEvacPlans = await dataContext.Floors.Where(f => f.Level < level)
                                                .OrderByDescending(f => f.Level)
                                                .Select(f => f.EvacuationPlan).ToListAsync();
            return restFloorsEvacPlans;
        }

    }
}