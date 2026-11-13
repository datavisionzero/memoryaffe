using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Memoryaffe.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SearchGenerations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PendingSearchLanguage",
                table: "Vaults",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Language",
                table: "SearchSegments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "SourceRevision",
                table: "SearchSegments",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
            migrationBuilder.Sql("UPDATE \"SearchSegments\" s SET \"Language\" = v.\"SearchLanguage\", \"SourceRevision\" = m.\"Revision\" FROM \"Memories\" m JOIN \"Vaults\" v ON v.\"Id\"=m.\"VaultId\" WHERE s.\"MemoryId\"=m.\"Id\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PendingSearchLanguage",
                table: "Vaults");

            migrationBuilder.DropColumn(
                name: "Language",
                table: "SearchSegments");

            migrationBuilder.DropColumn(
                name: "SourceRevision",
                table: "SearchSegments");
        }
    }
}
