namespace FireSaverApi.Dtos.BuildingDtos
{
    public class NewBuildingDto
    {
        public string Address { get; set; }
        public string Info { get; set; }
        public PositionDto BuildingCenterPosition { get; set; }
        public string Region { get; set; }
    }
}