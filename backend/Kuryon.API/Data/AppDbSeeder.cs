using Kuryon.API.Models;
using Microsoft.AspNetCore.Identity;

namespace Kuryon.API.Data;

public static class AppDbSeeder
{
    public static void SeedDevelopmentData(
        AppDbContext context,
        IPasswordHasher<User> passwordHasher,
        ILogger logger)
    {
        logger.LogInformation("Development seed is running.");
        SeedUsers(context, passwordHasher);
        SeedCouriers(context);
        SeedPackages(context);
        SeedShiftRecords(context);
        SeedCourierApplications(context);
    }

    private static void SeedUsers(AppDbContext context, IPasswordHasher<User> passwordHasher)
    {
        if (!context.Users.Any(u => u.Role == "admin" && u.Email == "admin@test.com"))
        {
            var user = new User
            {
                FullName = "Admin User",
                Email = "admin@test.com",
                PhoneNumber = string.Empty,
                Role = "admin"
            };
            user.Password = passwordHasher.HashPassword(user, "123456");
            context.Users.Add(new User
            {
                FullName = user.FullName,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                Password = user.Password,
                Role = user.Role
            });
        }

        if (!context.Users.Any(u => u.Role == "courier" && u.PhoneNumber == "5551112233"))
        {
            var user = new User
            {
                FullName = "Courier User",
                Email = string.Empty,
                PhoneNumber = "5551112233",
                Role = "courier"
            };
            user.Password = passwordHasher.HashPassword(user, "123456");
            context.Users.Add(new User
            {
                FullName = user.FullName,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                Password = user.Password,
                Role = user.Role
            });
        }

        context.SaveChanges();
    }

    private static void SeedCouriers(AppDbContext context)
    {
        if (!context.Couriers.Any(c => c.PhoneNumber == "5551112233"))
        {
            context.Couriers.Add(new Courier
            {
                FullName = "Courier User",
                PhoneNumber = "5551112233",
                Email = "courier@test.com",
                IsOnline = true,
                IsOnBreak = false,
                BreakReason = null,
                BreakMinutes = null,
                VehicleType = "Motorcycle",
                Region = "Merkez",
                Status = CourierStatusValues.Online,
                CreatedAt = DateTime.UtcNow
            });
        }

        if (!context.Couriers.Any(c => c.PhoneNumber == "5552223344"))
        {
            context.Couriers.Add(new Courier
            {
                FullName = "Courier Two",
                PhoneNumber = "5552223344",
                Email = "courier2@test.com",
                IsOnline = false,
                IsOnBreak = false,
                BreakReason = null,
                BreakMinutes = null,
                VehicleType = "Scooter",
                Region = "Talas",
                Status = CourierStatusValues.Offline,
                CreatedAt = DateTime.UtcNow
            });
        }

        context.SaveChanges();
    }

    private static void SeedPackages(AppDbContext context)
    {
        var firstCourier = context.Couriers.OrderBy(c => c.Id).FirstOrDefault();

        if (!context.Packages.Any(p => p.TrackingNumber == "TRK-1001"))
        {
            context.Packages.Add(new Package
            {
                TrackingNumber = "TRK-1001",
                CustomerName = "Ahmet Yilmaz",
                CustomerPhone = "5554445566",
                Address = "Kayseri Melikgazi",
                Description = "2x Burger",
                PaymentType = PaymentTypeValues.Cash,
                Price = 220,
                Status = PackageStatusValues.Assigned,
                AssignedCourierId = firstCourier?.Id,
                AssignedCourierName = firstCourier?.FullName,
                CreatedAt = DateTime.UtcNow.AddMinutes(-60)
            });
        }

        if (!context.Packages.Any(p => p.TrackingNumber == "TRK-1002"))
        {
            context.Packages.Add(new Package
            {
                TrackingNumber = "TRK-1002",
                CustomerName = "Ayse Demir",
                CustomerPhone = "5557778899",
                Address = "Kayseri Talas",
                Description = "Pizza",
                PaymentType = PaymentTypeValues.Card,
                Price = 180,
                Status = PackageStatusValues.Created,
                CreatedAt = DateTime.UtcNow.AddMinutes(-30)
            });
        }

        if (!context.Packages.Any(p => p.TrackingNumber == "TRK-1003"))
        {
            context.Packages.Add(new Package
            {
                TrackingNumber = "TRK-1003",
                CustomerName = "Mehmet Can",
                CustomerPhone = "5559990011",
                Address = "Kayseri Kocasinan",
                Description = "Doner",
                PaymentType = PaymentTypeValues.Online,
                Price = 140,
                Status = PackageStatusValues.Delivered,
                AssignedCourierId = firstCourier?.Id,
                AssignedCourierName = firstCourier?.FullName,
                CreatedAt = DateTime.UtcNow.AddHours(-3),
                DeliveredAt = DateTime.UtcNow.AddHours(-2)
            });
        }

        context.SaveChanges();
    }

    private static void SeedShiftRecords(AppDbContext context)
    {
        var firstCourier = context.Couriers.OrderBy(c => c.Id).FirstOrDefault();
        var secondCourier = context.Couriers.OrderBy(c => c.Id).Skip(1).FirstOrDefault();

        if (firstCourier is not null &&
            !context.ShiftRecords.Any(s => s.CourierId == firstCourier.Id && s.ActionType == "Online"))
        {
            context.ShiftRecords.Add(new ShiftRecord
            {
                CourierId = firstCourier.Id,
                CourierName = firstCourier.FullName,
                ActionType = "Online",
                CreatedAt = DateTime.UtcNow.AddHours(-4)
            });
        }

        if (secondCourier is not null &&
            !context.ShiftRecords.Any(s => s.CourierId == secondCourier.Id && s.ActionType == "Offline"))
        {
            context.ShiftRecords.Add(new ShiftRecord
            {
                CourierId = secondCourier.Id,
                CourierName = secondCourier.FullName,
                ActionType = "Offline",
                CreatedAt = DateTime.UtcNow.AddHours(-3)
            });
        }

        if (firstCourier is not null &&
            !context.ShiftRecords.Any(s => s.CourierId == firstCourier.Id && s.ActionType == "BreakStart"))
        {
            context.ShiftRecords.Add(new ShiftRecord
            {
                CourierId = firstCourier.Id,
                CourierName = firstCourier.FullName,
                ActionType = "BreakStart",
                Reason = "Yemek",
                Minutes = 20,
                CreatedAt = DateTime.UtcNow.AddHours(-2)
            });
        }

        context.SaveChanges();
    }

    private static void SeedCourierApplications(AppDbContext context)
    {
        if (!context.CourierApplications.Any(ca => ca.PhoneNumber == "5551110000"))
        {
            context.CourierApplications.Add(new CourierApplication
            {
                FullName = "Ali Basvuru",
                PhoneNumber = "5551110000",
                City = "Kayseri",
                VehicleType = "Motorcycle",
                Notes = "Deneyimli kurye",
                Status = "Pending",
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            });
        }

        if (!context.CourierApplications.Any(ca => ca.PhoneNumber == "5552220000"))
        {
            context.CourierApplications.Add(new CourierApplication
            {
                FullName = "Zeynep Aday",
                PhoneNumber = "5552220000",
                City = "Kayseri",
                VehicleType = "Bicycle",
                Notes = "Part-time",
                Status = "Approved",
                CreatedAt = DateTime.UtcNow.AddDays(-2)
            });
        }

        if (!context.CourierApplications.Any(ca => ca.PhoneNumber == "5553330000"))
        {
            context.CourierApplications.Add(new CourierApplication
            {
                FullName = "Mert Aday",
                PhoneNumber = "5553330000",
                City = "Ankara",
                VehicleType = "Car",
                Notes = "Tam zamanli",
                Status = "Rejected",
                CreatedAt = DateTime.UtcNow.AddDays(-3)
            });
        }

        context.SaveChanges();
    }
}
