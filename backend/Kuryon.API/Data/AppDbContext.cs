using Kuryon.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Kuryon.API.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Courier> Couriers => Set<Courier>();
    public DbSet<Package> Packages => Set<Package>();
    public DbSet<ShiftRecord> ShiftRecords => Set<ShiftRecord>();
    public DbSet<CourierApplication> CourierApplications => Set<CourierApplication>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.Property(x => x.FullName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(150).IsRequired();
            entity.Property(x => x.PhoneNumber).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Password).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Role).HasMaxLength(20).IsRequired();

            entity.HasIndex(x => new { x.Role, x.Email }).IsUnique().HasFilter("[Email] <> ''");
            entity.HasIndex(x => new { x.Role, x.PhoneNumber }).IsUnique().HasFilter("[PhoneNumber] <> ''");
        });

        modelBuilder.Entity<Courier>(entity =>
        {
            entity.Property(x => x.FullName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.PhoneNumber).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(150).IsRequired();
            entity.Property(x => x.BreakReason).HasMaxLength(250);
            entity.Property(x => x.VehicleType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Region).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(20).IsRequired();
            entity.Property(x => x.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(x => x.PhoneNumber).IsUnique();
            entity.HasIndex(x => x.Email).IsUnique();
        });

        modelBuilder.Entity<Package>(entity =>
        {
            entity.Property(x => x.TrackingNumber).HasMaxLength(40).IsRequired();
            entity.Property(x => x.CustomerName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.CustomerPhone).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Address).HasMaxLength(500).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(500).IsRequired();
            entity.Property(x => x.PaymentType).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Price).HasColumnType("decimal(18,2)");
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.AssignedCourierName).HasMaxLength(150);
            entity.Property(x => x.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(x => x.TrackingNumber).IsUnique();

            entity.HasOne(x => x.AssignedCourier)
                .WithMany(x => x.Packages)
                .HasForeignKey(x => x.AssignedCourierId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ShiftRecord>(entity =>
        {
            entity.Property(x => x.CourierName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.ActionType).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Reason).HasMaxLength(250);
            entity.Property(x => x.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(x => x.CreatedAt);

            entity.HasOne(x => x.Courier)
                .WithMany(x => x.ShiftRecords)
                .HasForeignKey(x => x.CourierId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<CourierApplication>(entity =>
        {
            entity.Property(x => x.FullName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.PhoneNumber).HasMaxLength(20).IsRequired();
            entity.Property(x => x.City).HasMaxLength(100).IsRequired();
            entity.Property(x => x.VehicleType).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(500);
            entity.Property(x => x.Status).HasMaxLength(30).IsRequired();
            entity.Property(x => x.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(x => x.PhoneNumber);
            entity.HasIndex(x => x.Status);
        });
    }
}
