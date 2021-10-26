using System.Collections.Generic;

namespace FireSaverApi.DataContext
{
    public class Floor : Compartment
    {
        public Floor() : base()
        {
            Rooms = new List<Room>();
            NearFloors = new List<Floor>();
        }

        public int Level { get; set; }
        public IList<Room> Rooms { get; set; }
        public Floor CurrentFloor { get; set; }
        public IList<Floor> NearFloors { get; set; }
        public Building BuildingWithThisFloor { get; set; }

    }
}