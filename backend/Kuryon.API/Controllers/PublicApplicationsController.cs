using Kuryon.API.Data;
using Kuryon.API.DTOs;
using Kuryon.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kuryon.API.Controllers;

[ApiController]
[Route("api/applications")]
public class PublicApplicationsController(AppDbContext context) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost]
    public async Task<ActionResult<CourierApplication>> CreateApplication(
        [FromBody] CreateCourierApplicationRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { message = "Invalid application payload.", errors = ModelState });
        }

        var application = new CourierApplication
        {
            FullName = request.FullName.Trim(),
            PhoneNumber = request.PhoneNumber.Trim(),
            City = request.City.Trim(),
            VehicleType = request.VehicleType.Trim(),
            Notes = request.Notes?.Trim(),
            Status = "Pending",
            CreatedAt = DateTime.UtcNow
        };

        context.CourierApplications.Add(application);
        await context.SaveChangesAsync();

        return Ok(application);
    }
}
