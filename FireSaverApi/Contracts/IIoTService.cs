using System.Threading.Tasks;
using FireSaverApi.Dtos;
using FireSaverApi.Dtos.IoTDtos;

namespace FireSaverApi.Contracts
{
    public interface IIoTService
    {
        Task AddIoTToDB(NewIoTDto newIot);
        Task DeleteIoTFromDB(string IoTIdentifier);

        Task RemoveIoTFromBuilding(int buildingId, string IotIdentifier);
        Task AddIoTToBuilding(int buildingId, string IotIdentifier);

        Task AddIoTToCompartment(int compartmentId, string IotIdentifier);
        Task RemoveIoTFromCompartment(int compartmentId, string IotIdentifier);
        
        Task UpdateIoTPostion(string IotIdentifier, PositionDto newPos);
    }
}