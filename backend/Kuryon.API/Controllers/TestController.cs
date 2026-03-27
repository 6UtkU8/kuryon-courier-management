using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kuryon.API.Controllers;

[ApiController]
[Route("api/test")]
public class TestController : ControllerBase
{
    private readonly bool _enabled;

    public TestController(IWebHostEnvironment environment, IConfiguration configuration)
    {
        _enabled = environment.IsDevelopment() || configuration.GetValue("Features:EnableTestEndpoints", false);
    }

    [Authorize]
    [HttpGet("protected")]
    public IActionResult Protected()
    {
        if (!_enabled)
        {
            return NotFound();
        }

        return Ok(new
        {
            Message = "Authenticated endpoint access granted.",
            User = User.Identity?.Name,
            Role = User.FindFirst("http://schemas.microsoft.com/ws/2008/06/identity/claims/role")?.Value
        });
    }

    [Authorize(Roles = "admin")]
    [HttpGet("admin-only")]
    public IActionResult AdminOnly()
    {
        if (!_enabled)
        {
            return NotFound();
        }

        return Ok(new
        {
            Message = "Admin endpoint access granted."
        });
    }

    [Authorize(Roles = "courier")]
    [HttpGet("courier-only")]
    public IActionResult CourierOnly()
    {
        if (!_enabled)
        {
            return NotFound();
        }

        return Ok(new
        {
            Message = "Courier endpoint access granted."
        });
    }
}
