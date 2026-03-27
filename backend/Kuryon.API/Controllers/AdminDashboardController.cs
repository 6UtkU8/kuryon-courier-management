using Kuryon.API.Data;
using Kuryon.API.DTOs;
using Kuryon.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kuryon.API.Controllers;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize(Roles = "admin")]
public class AdminDashboardController(AppDbContext context) : ControllerBase
{
    [HttpGet("metrics")]
    public async Task<ActionResult<AdminDashboardMetricsResponse>> GetMetrics()
    {
        var todayStart = DateTime.UtcNow.Date;
        var todayEnd = todayStart.AddDays(1);

        var totalCouriers = await context.Couriers.CountAsync();
        var onlineCouriers = await context.Couriers.CountAsync(c => c.IsOnline && !c.IsOnBreak);
        var onBreakCouriers = await context.Couriers.CountAsync(c => c.IsOnBreak);
        var offlineCouriers = totalCouriers - onlineCouriers - onBreakCouriers;

        var totalPackages = await context.Packages.CountAsync();
        var assignedPackages = await context.Packages.CountAsync(p =>
            p.Status != null && p.Status.ToLower() == PackageStatusValues.Assigned);

        var deliveredTodayPackages = await context.Packages
            .Where(p =>
                p.Status != null &&
                p.Status.ToLower() == PackageStatusValues.Delivered &&
                p.DeliveredAt != null &&
                p.DeliveredAt >= todayStart &&
                p.DeliveredAt < todayEnd)
            .ToListAsync();

        var pendingApplications = await context.CourierApplications
            .CountAsync(a => a.Status != null && a.Status.ToLower() == "pending");

        var response = new AdminDashboardMetricsResponse
        {
            TotalCouriers = totalCouriers,
            OnlineCouriers = onlineCouriers,
            OfflineCouriers = Math.Max(0, offlineCouriers),
            OnBreakCouriers = onBreakCouriers,
            TotalPackages = totalPackages,
            AssignedPackages = assignedPackages,
            DeliveredToday = deliveredTodayPackages.Count,
            PendingApplications = pendingApplications,
            TotalRevenueToday = deliveredTodayPackages.Sum(p => p.Price)
        };

        return Ok(response);
    }
}
