using Kuryon.API.Data;
using Kuryon.API.DTOs;
using Kuryon.API.Models;
using Kuryon.API.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kuryon.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly JwtTokenService _jwtTokenService;
    private readonly IPasswordHasher<User> _passwordHasher;

    public AuthController(
        AppDbContext context,
        JwtTokenService jwtTokenService,
        IPasswordHasher<User> passwordHasher)
    {
        _context = context;
        _jwtTokenService = jwtTokenService;
        _passwordHasher = passwordHasher;
    }

    [HttpPost("admin-login")]
    public async Task<ActionResult<LoginResponse>> AdminLogin([FromBody] AdminLoginRequest request)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u =>
                u.Role == "admin" &&
                u.Email == request.Email);

        if (user is null || !await VerifyPasswordAndUpgradeIfNeeded(user, request.Password))
        {
            return Unauthorized(new LoginResponse
            {
                Success = false,
                Message = "Admin login failed."
            });
        }

        return Ok(new LoginResponse
        {
            Success = true,
            Message = "Admin login successful.",
            UserId = user.Id,
            FullName = user.FullName,
            Role = user.Role,
            Token = _jwtTokenService.CreateToken(user)
        });
    }

    [HttpPost("courier-login")]
    public async Task<ActionResult<LoginResponse>> CourierLogin([FromBody] CourierLoginRequest request)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u =>
                u.Role == "courier" &&
                u.PhoneNumber == request.PhoneNumber);

        if (user is null || !await VerifyPasswordAndUpgradeIfNeeded(user, request.Password))
        {
            return Unauthorized(new LoginResponse
            {
                Success = false,
                Message = "Courier login failed."
            });
        }

        return Ok(new LoginResponse
        {
            Success = true,
            Message = "Courier login successful.",
            UserId = user.Id,
            FullName = user.FullName,
            Role = user.Role,
            Token = _jwtTokenService.CreateToken(user)
        });
    }

    private async Task<bool> VerifyPasswordAndUpgradeIfNeeded(User user, string plainPassword)
    {
        // Password field now stores password hash; this fallback keeps existing records compatible.
        PasswordVerificationResult verifyResult;
        try
        {
            verifyResult = _passwordHasher.VerifyHashedPassword(user, user.Password, plainPassword);
        }
        catch (FormatException)
        {
            verifyResult = PasswordVerificationResult.Failed;
        }

        if (verifyResult == PasswordVerificationResult.Success)
        {
            return true;
        }

        if (verifyResult == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.Password = _passwordHasher.HashPassword(user, plainPassword);
            await _context.SaveChangesAsync();
            return true;
        }

        if (user.Password == plainPassword)
        {
            user.Password = _passwordHasher.HashPassword(user, plainPassword);
            await _context.SaveChangesAsync();
            return true;
        }

        return false;
    }
}
