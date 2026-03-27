using System.ComponentModel.DataAnnotations;

namespace Kuryon.API.DTOs;

public class UpdatePackageStatusRequest
{
    [Required(ErrorMessage = "Status is required.")]
    public string Status { get; set; } = string.Empty;
}
