using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Memoryaffe.Infrastructure;
public class DesignFactory : IDesignTimeDbContextFactory<Database>
{
    public Database CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<Database>().UseNpgsql("Host=localhost;Database=memoryaffe_design").Options);
}
