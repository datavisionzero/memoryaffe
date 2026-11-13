using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Memoryaffe.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DataGuards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE FUNCTION memoryaffe_validate_record_tags() RETURNS trigger LANGUAGE plpgsql AS $$
                DECLARE m record; matched integer;
                BEGIN
                  SELECT * INTO m FROM "Memories" WHERE "Id" = NEW."Id";
                  IF NOT FOUND THEN RETURN NULL; END IF;
                  SELECT count(*) INTO matched FROM "Tags" WHERE "Id" = ANY(m."TagIds") AND "VaultId" = m."VaultId" AND "OwnerId" = m."OwnerId";
                  IF matched <> cardinality(m."TagIds") THEN RAISE EXCEPTION 'Invalid record/tag ownership or duplicate tag' USING ERRCODE = '23514'; END IF;
                  RETURN NULL;
                END $$;
                CREATE CONSTRAINT TRIGGER memoryaffe_record_tags AFTER INSERT OR UPDATE ON "Memories"
                  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION memoryaffe_validate_record_tags();
                CREATE FUNCTION memoryaffe_validate_deleted_tag() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                  IF EXISTS (SELECT 1 FROM "Memories" WHERE OLD."Id" = ANY("TagIds")) THEN
                    RAISE EXCEPTION 'Tag still referenced' USING ERRCODE = '23514';
                  END IF;
                  RETURN NULL;
                END $$;
                CREATE CONSTRAINT TRIGGER memoryaffe_tag_references AFTER DELETE ON "Tags"
                  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION memoryaffe_validate_deleted_tag();
                """);
            migrationBuilder.AddCheckConstraint(
                name: "CK_Vault_Settings",
                table: "Vaults",
                sql: "\"VersionLimit\" BETWEEN 0 AND 100 AND \"SearchLanguage\" IN ('neutral','de','en') AND \"Revision\" > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Tag_Limits",
                table: "Tags",
                sql: "\"Revision\" > 0 AND char_length(\"Name\") BETWEEN 1 AND 50");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Memory_Limits",
                table: "Memories",
                sql: "\"Revision\" > 0 AND char_length(\"Title\") BETWEEN 1 AND 200 AND char_length(\"Summary\") <= 1000 AND octet_length(\"Markdown\") <= 1048576 AND cardinality(\"TagIds\") <= 50");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Grant_Level",
                table: "Grants",
                sql: "\"Level\" BETWEEN 1 AND 3");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER memoryaffe_record_tags ON \"Memories\"; DROP TRIGGER memoryaffe_tag_references ON \"Tags\"; DROP FUNCTION memoryaffe_validate_record_tags(); DROP FUNCTION memoryaffe_validate_deleted_tag();");
            migrationBuilder.DropCheckConstraint(
                name: "CK_Vault_Settings",
                table: "Vaults");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Tag_Limits",
                table: "Tags");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Memory_Limits",
                table: "Memories");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Grant_Level",
                table: "Grants");
        }
    }
}
