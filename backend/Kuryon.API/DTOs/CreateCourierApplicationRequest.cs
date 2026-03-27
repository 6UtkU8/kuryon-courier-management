using System.ComponentModel.DataAnnotations;

namespace Kuryon.API.DTOs;

public class CreateCourierApplicationRequest
{
    [Required(ErrorMessage = "Full name is required.")]
    [StringLength(150, MinimumLength = 2, ErrorMessage = "Full name must be between 2 and 150 characters.")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required.")]
    [RegularExpression(@"^\+?\d[\d\s\-]{8,19}$", ErrorMessage = "Phone number format is invalid.")]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required(ErrorMessage = "City is required.")]
    [StringLength(100, ErrorMessage = "City is too long.")]
    public string City { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vehicle type is required.")]
    [StringLength(50, ErrorMessage = "Vehicle type is too long.")]
    public string VehicleType { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "Notes is too long.")]
    public string? Notes { get; set; }
}
