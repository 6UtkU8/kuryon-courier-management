namespace Kuryon.API.Entities;

public class Courier
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string VehicleType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? BreakReason { get; set; }
    public int BreakDurationMinutes { get; set; }
    public decimal TotalEarnings { get; set; }
    public int DeliveredPackageCount { get; set; }
}
