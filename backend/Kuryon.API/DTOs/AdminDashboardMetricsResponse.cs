namespace Kuryon.API.DTOs;

public class AdminDashboardMetricsResponse
{
    public int TotalCouriers { get; set; }
    public int OnlineCouriers { get; set; }
    public int OfflineCouriers { get; set; }
    public int OnBreakCouriers { get; set; }
    public int TotalPackages { get; set; }
    public int AssignedPackages { get; set; }
    public int DeliveredToday { get; set; }
    public int PendingApplications { get; set; }
    public decimal TotalRevenueToday { get; set; }
}
