using System.ComponentModel.DataAnnotations;

namespace Kuryon.API.DTOs;

public class CreatePackageRequest
{
    [StringLength(64, MinimumLength = 3, ErrorMessage = "Tracking number must be between 3 and 64 characters.")]
    public string? TrackingNumber { get; set; }

    [Required(ErrorMessage = "Customer name is required.")]
    [StringLength(150, MinimumLength = 2, ErrorMessage = "Customer name must be between 2 and 150 characters.")]
    public string CustomerName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Customer phone is required.")]
    [RegularExpression(@"^\+?\d[\d\s\-]{8,19}$", ErrorMessage = "Customer phone format is invalid.")]
    public string CustomerPhone { get; set; } = string.Empty;

    [Required(ErrorMessage = "Address is required.")]
    [StringLength(500, MinimumLength = 3, ErrorMessage = "Address must be between 3 and 500 characters.")]
    public string Address { get; set; } = string.Empty;

    [Required(ErrorMessage = "Description is required.")]
    [StringLength(500, ErrorMessage = "Description is too long.")]
    public string Description { get; set; } = string.Empty;

    [Required(ErrorMessage = "Payment type is required.")]
    public string PaymentType { get; set; } = string.Empty;

    [Range(0, 9999999, ErrorMessage = "Price cannot be negative.")]
    public decimal Price { get; set; }
}
