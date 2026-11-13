public sealed class ExportResponse(Func<Stream, Task> write) : IResult
{
    public async Task ExecuteAsync(HttpContext context)
    {
        context.Response.ContentType = "application/zip";
        context.Response.Headers.ContentDisposition = "attachment; filename=\"memoryaffe-vault.zip\"";
        await write(context.Response.Body);
    }
}
