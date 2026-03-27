using System.Text.Json.Serialization;

namespace Kuryon.API.Models;

public class Courier
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool IsOnline { get; set; }
    public bool IsOnBreak { get; set; }
    public string? BreakReason { get; set; }
    public int? BreakMinutes { get; set; }
    public string VehicleType { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public string Status { get; set; } = CourierStatusValues.Offline;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [JsonIgnore]
    public ICollection<Package> Packages { get; set; } = new List<Package>();

    [JsonIgnore]
    public ICollection<ShiftRecord> ShiftRecords { get; set; } = new List<ShiftRecord>();
}
