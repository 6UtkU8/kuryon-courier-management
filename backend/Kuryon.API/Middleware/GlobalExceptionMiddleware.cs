using System.Text.Json;
using Kuryon.API.Models;

namespace Kuryon.API.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(
        RequestDelegate next,
        IWebHostEnvironment environment,
        ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _environment = environment;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            var traceId = context.TraceIdentifier;
            _logger.LogError(ex, "Unhandled exception. TraceId: {TraceId}", traceId);

            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";

            object errorPayload = _environment.IsDevelopment()
                ? new
                {
                    traceId,
                    detail = ex.Message
                }
                : new
                {
                    traceId
                };

            var payload = ApiResponse<object>.Fail(
                "Beklenmeyen bir hata oluştu.",
                errorPayload);

            var json = JsonSerializer.Serialize(payload);
            await context.Response.WriteAsync(json);
        }
    }
}
