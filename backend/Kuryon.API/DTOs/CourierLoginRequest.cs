namespace Kuryon.API.DTOs;

public class CourierLoginRequest
{
    public string PhoneNumber { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
