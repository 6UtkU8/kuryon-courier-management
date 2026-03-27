using Kuryon.API.Data;
using Kuryon.API.DTOs;
using Kuryon.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kuryon.API.Controllers;

[ApiController]
[Route("api/admin/packages")]
[Authorize(Roles = "admin")]
public class AdminPackagesController(AppDbContext context) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Package>>> GetPackages()
    {
        var packages = await context.Packages
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
        return Ok(packages);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Package>> GetPackageById(int id)
    {
        var package = await context.Packages.FirstOrDefaultAsync(p => p.Id == id);
        if (package is null)
        {
            return NotFound();
        }

        return Ok(package);
    }

    [HttpPost]
    public async Task<ActionResult<Package>> CreatePackage([FromBody] CreatePackageRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { message = "Invalid package payload.", errors = ModelState });
        }

        var paymentType = PaymentTypeValues.Normalize(request.PaymentType);
        if (!PaymentTypeValues.IsValid(paymentType))
        {
            return BadRequest(new { message = "Invalid paymentType. Allowed: cash, card, online." });
        }

        var package = new Package
        {
            TrackingNumber = string.IsNullOrWhiteSpace(request.TrackingNumber)
                ? $"TRK-{DateTime.UtcNow:yyyyMMddHHmmssfff}"
                : request.TrackingNumber.Trim(),
            CustomerName = request.CustomerName.Trim(),
            CustomerPhone = request.CustomerPhone.Trim(),
            Address = request.Address.Trim(),
            Description = request.Description.Trim(),
            PaymentType = paymentType,
            Price = request.Price,
            Status = PackageStatusValues.Created,
            CreatedAt = DateTime.UtcNow
        };

        context.Packages.Add(package);
        await context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPackageById), new { id = package.Id }, package);
    }

    [HttpPut("{id:int}/assign/{courierId:int}")]
    public async Task<ActionResult<Package>> AssignPackage(int id, int courierId)
    {
        var package = await context.Packages.FirstOrDefaultAsync(p => p.Id == id);
        if (package is null)
        {
            return NotFound(new { message = "Package not found." });
        }

        var courier = await context.Couriers.FirstOrDefaultAsync(c => c.Id == courierId);
        if (courier is null)
        {
            return NotFound(new { message = "Courier not found." });
        }

        package.AssignedCourierId = courier.Id;
        package.AssignedCourierName = courier.FullName;
        package.Status = PackageStatusValues.Assigned;

        await context.SaveChangesAsync();
        return Ok(package);
    }

    [HttpPut("{id:int}/status")]
    public async Task<ActionResult<Package>> UpdatePackageStatus(int id, [FromBody] UpdatePackageStatusRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { message = "Invalid status payload.", errors = ModelState });
        }

        var package = await context.Packages.FirstOrDefaultAsync(p => p.Id == id);
        if (package is null)
        {
            return NotFound(new { message = "Package not found." });
        }

        var normalizedStatus = PackageStatusValues.Normalize(request.Status);
        if (!PackageStatusValues.IsValid(normalizedStatus))
        {
            return BadRequest(new
            {
                message = "Invalid package status. Allowed: created, assigned, picked_up, out_for_delivery, delivered, failed, cancelled."
            });
        }

        package.Status = normalizedStatus;
        package.DeliveredAt = normalizedStatus == PackageStatusValues.Delivered
            ? DateTime.UtcNow
            : null;

        await context.SaveChangesAsync();
        return Ok(package);
    }
}
