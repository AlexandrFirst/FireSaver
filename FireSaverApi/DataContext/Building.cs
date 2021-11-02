using System.Collections.Generic;

namespace FireSaverApi.DataContext
{
    public class Building
    {
        public Building()
        {
            ResponsibleUsers = new List<User>();
            Floors = new List<Floor>();
            IoTs = new List<IoT>();
        }

        public int Id { get; set; }
        public IList<User> ResponsibleUsers { get; set; }
        public IList<Floor> Floors { get; set; }
        public IList<IoT> IoTs { get; set; }
        public string Address { get; set; }
        public string Info { get; set; }
        public Position BuildingCenterPosition { get; set; }
        public int? BuildingCenterPositionId { get; set; }
        public double SafetyDistance { get; set; }
    }
}