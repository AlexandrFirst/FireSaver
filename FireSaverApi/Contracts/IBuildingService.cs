using System.Collections.Generic;
using System.Threading.Tasks;
using FireSaverApi.DataContext;
using FireSaverApi.Dtos.BuildingDtos;
using FireSaverApi.Dtos.CompartmentDtos;
using FireSaverApi.Helpers.Pagination;
using static FireSaverApi.Common.RegionXmlClass;

namespace FireSaverApi.Contracts
{
    public interface IBuildingService
    {
        Task<BuildingInfoDto> AddNewBuilding(NewBuildingDto newBuilding);
        Task<BuildingInfoDto> AddResponsibleUser(int userId, int buildingId);
        Task<BuildingInfoDto> RemoveResponsibleUser(int userId, int buildingId);
        Task<BuildingInfoDto> UpdateBuildingInfo(int buildingId, NewBuildingDto newBuildingInfo);

        Task<BuildingInfoDto> UpdateBuildingCenter(int buildingId, BuildingCenterDto buildingCenter);
        Task DeleteBuilding(int buildingId);
        Task<PagedList<BuildingInfoDto>> GetAllBuildings(BuildingFilterParams buildingFilter);
        Task ReleaseAllBlockedPoints(int buildingId);
        Task<CompartmentCommonInfo> GetCompartmentById(int compartmentId);

        Task<ShelterDto> GetShelterInfo(int shelterId);
        Task<ShelterDto> AddShelter(int buildingId, ShelterDto newShelter);
        Task<ShelterDto> UpdateShelter(int shelterId, ShelterDto newShelter);
        Task<bool> RemoveShelter(int shelterId);

        Task<bool> EnterShelter(int shelterId, User user);
        Task<bool> LeaveShelter(int userId);
        List<Region> GetAllRegions();
    }
}