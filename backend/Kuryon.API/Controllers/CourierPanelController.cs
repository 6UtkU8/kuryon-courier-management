using System.Security.Claims;
using Kuryon.API.Data;
using Kuryon.API.DTOs;
using Kuryon.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kuryon.API.Controllers;

[ApiController]
[Route("api/courier")]
[Authorize(Roles = "courier")]
public class CourierPanelController(AppDbContext context) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<Courier>> GetMe()
    {
        var courier = await ResolveCourierFromTokenAsync();
        if (courier is null)
        {
            return NotFound(new { message = "Courier profile not found." });
        }

        return Ok(courier);
    }

    [HttpGet("my-packages")]
    public async Task<ActionResult<IEnumerable<Package>>> GetMyPackages()
    {
        var courier = await ResolveCourierFromTokenAsync();
        if (courier is null)
        {
            return NotFound(new { message = "Courier profile not found." });
        }

        var packages = await context.Packages
            .Where(p =>
                p.AssignedCourierId == courier.Id &&
                (p.Status == null || p.Status.ToLower() != PackageStatusValues.Delivered))
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        return Ok(packages);
    }

    [HttpGet("my-history")]
    public async Task<ActionResult<IEnumerable<Package>>> GetMyHistory()
    {
        var courier = await ResolveCourierFromTokenAsync();
        if (courier is null)
        {
            return NotFound(new { message = "Courier profile not found." });
        }

        var history = await context.Packages
            .Where(p =>
                p.AssignedCourierId == courier.Id &&
                p.Status != null &&
                p.Status.ToLower() == PackageStatusValues.Delivered)
            .OrderByDescending(p => p.DeliveredAt)
            .ToListAsync();

        return Ok(history);
    }

    [HttpGet("my-report")]
    public async Task<ActionResult<object>> GetMyReport()
    {
        var courier = await ResolveCourierFromTokenAsync();
        if (courier is null)
        {
            return NotFound(new { message = "Courier profile not found." });
        }

        var deliveredPackages = await context.Packages
            .Where(p =>
                p.AssignedCourierId == courier.Id &&
                p.Status != null &&
                p.Status.ToLower() == PackageStatusValues.Delivered)
            .ToListAsync();

        var activePackageCount = await context.Packages.CountAsync(p =>
            p.AssignedCourierId == courier.Id &&
            (p.Status == null || p.Status.ToLower() != PackageStatusValues.Delivered));

        var totalRevenue = deliveredPackages.Sum(p => p.Price);
        var deliveredCount = deliveredPackages.Count;
        var averagePrice = deliveredCount == 0 ? 0 : totalRevenue / deliveredCount;
        var todayStart = DateTime.UtcNow.Date;
        var todayEnd = todayStart.AddDays(1);
        var deliveredToday = deliveredPackages.Count(p =>
            p.DeliveredAt != null &&
            p.DeliveredAt >= todayStart &&
            p.DeliveredAt < todayEnd);

        return Ok(new
        {
            DeliveredCount = deliveredCount,
            DeliveredToday = deliveredToday,
            TotalRevenue = totalRevenue,
            AveragePrice = averagePrice,
            ActivePackageCount = activePackageCount,
            CurrentStatus = courier.Status
        });
    }

    [HttpPut("status")]
    public async Task<ActionResult<Courier>> UpdateMyStatus([FromBody] UpdateCourierStatusRequest request)
    {
        var courier = await ResolveCourierFromTokenAsync();
        if (courier is null)
        {
            return NotFound(new { message = "Courier profile not found." });
        }

        if (!TryResolveTargetStatus(request, out var targetStatus))
        {
            return BadRequest(new { message = "Invalid status value. Allowed: online, offline, break." });
        }

        if (targetStatus == CourierStatusValues.Break)
        {
            if (string.IsNullOrWhiteSpace(request.BreakReason))
            {
                return BadRequest(new { message = "BreakReason is required for break status." });
            }

            if (request.BreakMinutes is null or <= 0)
            {
                return BadRequest(new { message = "BreakMinutes must be greater than 0 for break status." });
            }
        }

        ApplyStatus(courier, targetStatus, request);

        var actionType = ResolveShiftActionType(targetStatus);
        if (actionType is not null)
        {
            context.ShiftRecords.Add(new ShiftRecord
            {
                CourierId = courier.Id,
                CourierName = string.IsNullOrWhiteSpace(courier.FullName) ? $"Courier-{courier.Id}" : courier.FullName,
                ActionType = actionType,
                Reason = targetStatus == CourierStatusValues.Break ? courier.BreakReason : null,
                Minutes = targetStatus == CourierStatusValues.Break ? courier.BreakMinutes : null,
                CreatedAt = DateTime.UtcNow
            });
        }

        await context.SaveChangesAsync();
        return Ok(courier);
    }

    [HttpPut("packages/{id:int}/deliver")]
    public async Task<ActionResult<Package>> DeliverPackage(int id)
    {
        var courier = await ResolveCourierFromTokenAsync();
        if (courier is null)
        {
            return NotFound(new { message = "Courier profile not found." });
        }

        var package = await context.Packages.FirstOrDefaultAsync(p => p.Id == id);
        if (package is null)
        {
            return NotFound(new { message = "Package not found." });
        }

        if (package.AssignedCourierId != courier.Id)
        {
            return Forbid();
        }

        package.Status = PackageStatusValues.Delivered;
        package.DeliveredAt = DateTime.UtcNow;

        await context.SaveChangesAsync();
        return Ok(package);
    }

    private async Task<Courier?> ResolveCourierFromTokenAsync()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return null;
        }

        var user = await context.Users.FirstOrDefaultAsync(u => u.Id == userId && u.Role == "courier");
        if (user is null)
        {
            return null;
        }

        return await context.Couriers.FirstOrDefaultAsync(c => c.PhoneNumber == user.PhoneNumber);
    }

    private static bool TryResolveTargetStatus(UpdateCourierStatusRequest request, out string targetStatus)
    {
        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            targetStatus = request.Status.Trim().ToLowerInvariant();
            return CourierStatusValues.IsValid(targetStatus);
        }

        if (request.IsOnBreak == true)
        {
            targetStatus = CourierStatusValues.Break;
            return true;
        }

        if (request.IsOnline is not null)
        {
            targetStatus = request.IsOnline.Value ? CourierStatusValues.Online : CourierStatusValues.Offline;
            return true;
        }

        targetStatus = string.Empty;
        return false;
    }

    private static void ApplyStatus(Courier courier, string targetStatus, UpdateCourierStatusRequest request)
    {
        if (targetStatus == CourierStatusValues.Online)
        {
            courier.IsOnline = true;
            courier.IsOnBreak = false;
            courier.BreakReason = null;
            courier.BreakMinutes = null;
            courier.Status = CourierStatusValues.Online;
            return;
        }

        if (targetStatus == CourierStatusValues.Offline)
        {
            courier.IsOnline = false;
            courier.IsOnBreak = false;
            courier.BreakReason = null;
            courier.BreakMinutes = null;
            courier.Status = CourierStatusValues.Offline;
            return;
        }

        courier.IsOnline = true;
        courier.IsOnBreak = true;
        courier.BreakReason = request.BreakReason?.Trim();
        courier.BreakMinutes = request.BreakMinutes;
        courier.Status = CourierStatusValues.Break;
    }

    private static string? ResolveShiftActionType(string targetStatus)
    {
        return targetStatus switch
        {
            CourierStatusValues.Online => CourierStatusValues.Online,
            CourierStatusValues.Offline => CourierStatusValues.Offline,
            CourierStatusValues.Break => CourierStatusValues.Break,
            _ => null
        };
    }
}
