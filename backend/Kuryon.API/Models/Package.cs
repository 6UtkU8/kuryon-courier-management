using System.Text.Json.Serialization;

namespace Kuryon.API.Models;

public class Package
{
    public int Id { get; set; }
    public string TrackingNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string PaymentType { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string Status { get; set; } = PackageStatusValues.Created;
    public int? AssignedCourierId { get; set; }
    public string? AssignedCourierName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeliveredAt { get; set; }

    [JsonIgnore]
    public Courier? AssignedCourier { get; set; }
}
