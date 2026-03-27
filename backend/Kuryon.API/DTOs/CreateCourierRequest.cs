using System.ComponentModel.DataAnnotations;

namespace Kuryon.API.DTOs;

public class CreateCourierRequest
{
    [Required(ErrorMessage = "Full name is required.")]
    [StringLength(150, MinimumLength = 2, ErrorMessage = "Full name must be between 2 and 150 characters.")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required.")]
    [RegularExpression(@"^\+?\d[\d\s\-]{8,19}$", ErrorMessage = "Phone number format is invalid.")]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Email format is invalid.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vehicle type is required.")]
    [StringLength(50, ErrorMessage = "Vehicle type is too long.")]
    public string VehicleType { get; set; } = string.Empty;

    [Required(ErrorMessage = "Region is required.")]
    [StringLength(100, ErrorMessage = "Region is too long.")]
    public string Region { get; set; } = string.Empty;
}
