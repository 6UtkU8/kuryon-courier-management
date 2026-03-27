namespace Kuryon.API.DTOs;

public class UpdateCourierStatusRequest
{
    public bool? IsOnline { get; set; }
    public bool? IsOnBreak { get; set; }
    public string? BreakReason { get; set; }
    public int? BreakMinutes { get; set; }
    public string? Status { get; set; }
}
