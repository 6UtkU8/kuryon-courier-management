using Kuryon.API.Data;
using Kuryon.API.DTOs;
using Kuryon.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kuryon.API.Controllers;

[ApiController]
[Route("api/admin/couriers")]
[Authorize(Roles = "admin")]
public class AdminCouriersController(AppDbContext context) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Courier>>> GetCouriers()
    {
        var couriers = await context.Couriers
            .OrderBy(c => c.Id)
            .ToListAsync();
        return Ok(couriers);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Courier>> GetCourierById(int id)
    {
        var courier = await context.Couriers.FirstOrDefaultAsync(c => c.Id == id);
        if (courier is null)
        {
            return NotFound();
        }

        return Ok(courier);
    }

    [HttpPost]
    public async Task<ActionResult<Courier>> CreateCourier([FromBody] CreateCourierRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { message = "Invalid courier payload.", errors = ModelState });
        }

        var courier = new Courier
        {
            FullName = request.FullName.Trim(),
            PhoneNumber = request.PhoneNumber.Trim(),
            Email = request.Email.Trim(),
            VehicleType = request.VehicleType.Trim(),
            Region = request.Region.Trim(),
            IsOnline = false,
            IsOnBreak = false,
            Status = CourierStatusValues.Offline,
            CreatedAt = DateTime.UtcNow
        };

        context.Couriers.Add(courier);
        await context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCourierById), new { id = courier.Id }, courier);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<Courier>> UpdateCourier(int id, [FromBody] UpdateCourierRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { message = "Invalid courier update payload.", errors = ModelState });
        }

        var courier = await context.Couriers.FirstOrDefaultAsync(c => c.Id == id);
        if (courier is null)
        {
            return NotFound();
        }

        courier.FullName = request.FullName.Trim();
        courier.PhoneNumber = request.PhoneNumber.Trim();
        courier.Email = request.Email.Trim();
        courier.VehicleType = request.VehicleType.Trim();
        courier.Region = request.Region.Trim();

        await context.SaveChangesAsync();
        return Ok(courier);
    }

    [HttpPut("{id:int}/status")]
    public async Task<ActionResult<Courier>> UpdateCourierStatus(int id, [FromBody] UpdateCourierStatusRequest request)
    {
        var courier = await context.Couriers.FirstOrDefaultAsync(c => c.Id == id);
        if (courier is null)
        {
            return NotFound(new { message = "Courier not found." });
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
