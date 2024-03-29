using System.Collections.Generic;

namespace FireSaverApi.DataContext
{
    public class Compartment
    {
        public Compartment()
        {
            Iots = new List<IoT>();
            InboundUsers = new List<User>();
            ExitPoints = new List<ExitPoint>();
        }
        public int Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public EvacuationPlan EvacuationPlan { get; set; }
        public int? EvacuationPlanId { get; set; }
        public string CompartmentPointsDataPublicId { get; set; }
        public List<ExitPoint> ExitPoints { get; set; }
        public string SafetyRules { get; set; }
        public Test CompartmentTest { get; set; }
        public int? CompartmentTestId { get; set; }

        public IList<IoT> Iots { get; set; }
        public IList<User> InboundUsers { get; set; }
    }
}