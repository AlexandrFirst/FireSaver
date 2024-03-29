using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using AutoMapper;
using FireSaverApi.Common;
using FireSaverApi.Contracts;
using FireSaverApi.DataContext;
using FireSaverApi.Dtos;
using FireSaverApi.Dtos.BuildingDtos;
using FireSaverApi.Dtos.CompartmentDtos;
using FireSaverApi.Helpers;
using FireSaverApi.Helpers.ExceptionHandler.CustomExceptions;
using FireSaverApi.Helpers.Pagination;
using FireSaverApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FireSaverApi.Services
{
    public class BuildingService : IBuildingService, IBuildingHelper
    {
        private readonly DatabaseContext context;
        private readonly IMapper mapper;
        private readonly IUserHelper userHelper;
        private readonly IUserContextService userContextService;
        private readonly ICompartmentHelper compartmentHelper;
        private readonly IHttpClientFactory clientFactory;
        private readonly RegionListService regionsList;
        private readonly GoogleApiInfo googleApiOptions;

        public BuildingService(DatabaseContext context,
                                IMapper mapper,
                                IUserHelper userHelper,
                                IUserContextService userContextService,
                                ICompartmentHelper compartmentHelper,
                                IHttpClientFactory clientFactory,
                                IOptions<GoogleApiInfo> googleApiOptions,
                                RegionListService regionsList)
        {
            this.userHelper = userHelper;
            this.userContextService = userContextService;
            this.compartmentHelper = compartmentHelper;
            this.clientFactory = clientFactory;
            this.regionsList = regionsList;
            this.googleApiOptions = googleApiOptions.Value;
            this.context = context;
            this.mapper = mapper;
        }

        public async Task<BuildingInfoDto> AddNewBuilding(NewBuildingDto newBuilding)
        {
            var building = mapper.Map<Building>(newBuilding);
            await context.Buildings.AddAsync(building);
            await context.SaveChangesAsync();

            return mapper.Map<BuildingInfoDto>(building);
        }

        public async Task<BuildingInfoDto> AddResponsibleUser(int userId, int buildingId)
        {
            var user = await userHelper.GetUserById(userId);
            if (user.ResponsibleForBuilding == null)
            {
                var building = await GetBuildingById(buildingId);
                building.ResponsibleUsers.Add(user);
                await context.SaveChangesAsync();

                return mapper.Map<BuildingInfoDto>(building);
            }
            else
            {
                throw new UserIsAlredyResponsibleForBuilding();
            }
        }

        public async Task DeleteBuilding(int buildingId)
        {
            var building = await GetBuildingById(buildingId);
            foreach (var floor in building.Floors)
            {
                foreach (var room in floor.Rooms)
                {
                    if (room.InboundUsers.Count > 0)
                    {
                        throw new DeleteBuildingException();
                    }
                }
            }

            context.Buildings.Remove(building);
            await context.SaveChangesAsync();
        }

        public async Task<BuildingInfoDto> RemoveResponsibleUser(int userId, int buildingId)
        {

            var user = await userHelper.GetUserById(userId);

            if (user.ResponsibleForBuilding.Id != buildingId)
            {
                throw new System.Exception("Ypu can delete only resposible users from your building");
            }

            user.ResponsibleForBuilding = null;

            await context.SaveChangesAsync();

            var building = await GetBuildingById(buildingId);
            return mapper.Map<BuildingInfoDto>(building);
        }

        public async Task<BuildingInfoDto> UpdateBuildingCenter(int buildingId, BuildingCenterDto buildingCenter)
        {
            var updatedBuilding = await GetBuildingById(buildingId);

            mapper.Map(buildingCenter, updatedBuilding);

            context.Buildings.Update(updatedBuilding);
            await context.SaveChangesAsync();

            return mapper.Map<BuildingInfoDto>(updatedBuilding);
        }

        public async Task<BuildingInfoDto> UpdateBuildingInfo(int buildingId, NewBuildingDto newBuildingInfo)
        {

            var updatedBuilding = await GetBuildingById(buildingId);

            mapper.Map(newBuildingInfo, updatedBuilding);

            context.Buildings.Update(updatedBuilding);
            await context.SaveChangesAsync();

            return mapper.Map<BuildingInfoDto>(updatedBuilding);

        }


        public async Task<Building> GetBuildingById(int buildingId)
        {
            var building = await context.Buildings.Include(b => b.ResponsibleUsers)
                                                    .Include(s => s.Shelters)
                                                    .ThenInclude(u => u.Users)
                                                   .Include(f => f.Floors)
                                                   .ThenInclude(r => r.Rooms)
                                                   .ThenInclude(u => u.InboundUsers)
                                                   .FirstOrDefaultAsync(b => b.Id == buildingId);

            if (building == null)
                throw new System.Exception("Building is not found by id");

            return building;
        }

        public async Task<PagedList<BuildingInfoDto>> GetAllBuildings(BuildingFilterParams buildingFilter)
        {
            var allBuildings = await context.Buildings.ToListAsync();
            if (buildingFilter.BuildingId > 0)
            {
                allBuildings = allBuildings.Where(b => b.Id == buildingFilter.BuildingId).ToList();
            }

            if (!string.IsNullOrEmpty(buildingFilter.Address))
            {
                allBuildings = allBuildings.Where(b => b.Address.ToLower().Contains(buildingFilter.Address)).ToList();
            }

            var allBuildingsDto = mapper.Map<List<BuildingInfoDto>>(allBuildings);


            return PagedList<BuildingInfoDto>.CreateAsync(allBuildingsDto, buildingFilter.PageNumber, buildingFilter.PageSize);
        }

        public async Task ReleaseAllBlockedPoints(int buildingId)
        {

        }

        private async Task<List<Compartment>> GetAllBuildingCompartment(int buildingId)
        {
            var buidling = await GetBuildingById(buildingId);
            List<Compartment> allCompartments = new List<Compartment>();

            foreach (var floor in buidling.Floors)
            {
                allCompartments.Add(floor);
                foreach (var room in floor.Rooms)
                {
                    allCompartments.Add(room);
                }
            }
            return allCompartments;
        }

        public async Task<Building> GetBuildingByCompartment(int compartmentId)
        {
            var compartment = await context.Compartment.FirstOrDefaultAsync(c => c.Id == compartmentId);
            if (compartment == null)
                throw new System.Exception("Can't determine building");

            var compFloor = compartment as Floor;
            var compRoom = compartment as Room;

            if (compFloor != null)
            {
                var f_compartment = await context.Floors.Include(b => b.BuildingWithThisFloor).ThenInclude(u => u.ResponsibleUsers)
                    .FirstOrDefaultAsync(c => c.Id == compartmentId);

                return f_compartment.BuildingWithThisFloor;
            }
            else
            {
                var r_compartment = await context.Rooms.Include(f => f.RoomFloor).ThenInclude(b => b.BuildingWithThisFloor).ThenInclude(u => u.ResponsibleUsers)
                    .FirstOrDefaultAsync(r => r.Id == compartmentId);
                return r_compartment.RoomFloor.BuildingWithThisFloor;
            }

        }

        public async Task<CompartmentCommonInfo> GetCompartmentById(int compartmentId)
        {
            var compartment = await compartmentHelper.GetCompartmentById(compartmentId);
            return mapper.Map<CompartmentCommonInfo>(compartment);
        }

        public async Task<ShelterDto> AddShelter(int buildingId, ShelterDto newShelter)
        {
            var building = await GetBuildingById(buildingId);
            Shelter shelter = mapper.Map<Shelter>(newShelter);

            var buildingDto = mapper.Map<BuildingInfoDto>(building);
            shelter.Distance = await calculateDistance(buildingDto.BuildingCenterPosition, newShelter.ShelterPosition);

            building.Shelters.Add(shelter);
            await context.SaveChangesAsync();
            return mapper.Map<ShelterDto>(shelter);
        }

        public async Task<ShelterDto> UpdateShelter(int shelterId, ShelterDto newShelter)
        {
            var shelter = await context.Shelters.Include(b => b.Building).FirstOrDefaultAsync(s => s.Id == shelterId);
            var buildingDto = mapper.Map<BuildingInfoDto>(shelter.Building);
            if (shelter == null)
            {
                return null;
            }
            mapper.Map(newShelter, shelter);

            shelter.Distance = await calculateDistance(buildingDto.BuildingCenterPosition, newShelter.ShelterPosition);

            await context.SaveChangesAsync();
            return mapper.Map<ShelterDto>(shelter);
        }

        string convertDoubleToString(double value)
        {
            NumberFormatInfo nfi = new NumberFormatInfo();
            nfi.NumberDecimalSeparator = ".";

            return value.ToString(nfi);
        }


        private async Task<int> calculateDistance(PositionDto origin, PositionDto dest)
        {
            var request = new HttpRequestMessage(HttpMethod.Get,
                string.Format($"https://maps.googleapis.com/maps/api/distancematrix/json?destinations={convertDoubleToString(dest.Latitude)},{convertDoubleToString(dest.Longtitude)}" +
                $"&origins={convertDoubleToString(origin.Latitude)},{convertDoubleToString(origin.Longtitude)}" +
                $"&key={googleApiOptions.GOOGLE_KEY}"));


            var _clinet = clientFactory.CreateClient();
            var response = await _clinet.SendAsync(request);

            if (response.IsSuccessStatusCode)
            {
                using var responseStream = await response.Content.ReadAsStreamAsync();
                var deserializedResponse = await JsonSerializer.DeserializeAsync
                    <GoogleApiDistanceResponse>(responseStream);
                return deserializedResponse.rows.First().elements.First().distance.value;
            }

            return int.MaxValue;
        }

        public async Task<ShelterDto> GetShelterInfo(int shelterId)
        {
            var shelter = await context.Shelters.FirstOrDefaultAsync(s => s.Id == shelterId);
            return mapper.Map<ShelterDto>(shelter);
        }

        public async Task<bool> RemoveShelter(int shelterId)
        {
            var shelter = await context.Shelters.FirstOrDefaultAsync(s => s.Id == shelterId);
            if (shelter == null)
            {
                return false;
            }

            context.Remove(shelter);
            await context.SaveChangesAsync();
            return true;

        }

        public async Task<bool> EnterShelter(int shelterId, User user)
        {
            var shelter = await context.Shelters.FirstOrDefaultAsync(s => s.Id == shelterId);
            if (shelter == null)
            {
                return false;
            }
            user.CurrentCompartment = null;
            shelter.Users.Add(user);

            context.Update(shelter);
            context.Update(user);

            await context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> LeaveShelter(int userId)
        {
            var user = await userHelper.GetUserById(userId);
            user.Shelter = null;
            context.Update(user);
            
            await context.SaveChangesAsync();
            return true;
        }

        public List<RegionXmlClass.Region> GetAllRegions()
        {
            return regionsList.getAllRegions();
        }
    }

}