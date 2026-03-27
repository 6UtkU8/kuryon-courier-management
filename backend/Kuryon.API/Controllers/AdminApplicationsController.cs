using Kuryon.API.Data;
using Kuryon.API.DTOs;
using Kuryon.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kuryon.API.Controllers;

[ApiController]
[Route("api/admin/applications")]
[Authorize(Roles = "admin")]
public class AdminApplicationsController(AppDbContext context) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<CourierApplication>>> GetApplications()
    {
        var applications = await context.CourierApplications
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
        return Ok(applications);
    }

    [HttpPost("{id:int}/review")]
    public async Task<ActionResult<CourierApplication>> ReviewApplication(
        int id,
        [FromBody] ReviewCourierApplicationRequest request)
    {
        var application = await context.CourierApplications.FirstOrDefaultAsync(a => a.Id == id);
        if (application is null)
        {
            return NotFound();
        }

        if (request.Status is not ("Pending" or "Approved" or "Rejected"))
        {
            return BadRequest(new { message = "Invalid status value." });
        }

        application.Status = request.Status;
        await context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Application review status updated.",
            data = application
        });
    }
}
