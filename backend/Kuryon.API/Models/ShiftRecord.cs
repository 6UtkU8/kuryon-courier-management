using System.Text.Json.Serialization;

namespace Kuryon.API.Models;

public class ShiftRecord
{
    public int Id { get; set; }
    public int CourierId { get; set; }
    public string CourierName { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public int? Minutes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [JsonIgnore]
    public Courier? Courier { get; set; }
}
