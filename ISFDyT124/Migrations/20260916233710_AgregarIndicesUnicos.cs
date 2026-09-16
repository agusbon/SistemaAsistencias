using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ISFDyT124.Migrations
{
    /// <inheritdoc />
    public partial class AgregarIndicesUnicos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Inscripciones_UsId",
                table: "Inscripciones");

            migrationBuilder.DropIndex(
                name: "IX_CarreraMateria_CaId",
                table: "CarreraMateria");

            migrationBuilder.DropIndex(
                name: "IX_CarreraCohortes_CaId",
                table: "CarreraCohortes");

            migrationBuilder.CreateIndex(
                name: "IX_Inscripciones_UsId_CaMaId",
                table: "Inscripciones",
                columns: new[] { "UsId", "CaMaId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CarreraMateria_CaId_MaId",
                table: "CarreraMateria",
                columns: new[] { "CaId", "MaId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CarreraCohortes_CaId_CoId",
                table: "CarreraCohortes",
                columns: new[] { "CaId", "CoId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Inscripciones_UsId_CaMaId",
                table: "Inscripciones");

            migrationBuilder.DropIndex(
                name: "IX_CarreraMateria_CaId_MaId",
                table: "CarreraMateria");

            migrationBuilder.DropIndex(
                name: "IX_CarreraCohortes_CaId_CoId",
                table: "CarreraCohortes");

            migrationBuilder.CreateIndex(
                name: "IX_Inscripciones_UsId",
                table: "Inscripciones",
                column: "UsId");

            migrationBuilder.CreateIndex(
                name: "IX_CarreraMateria_CaId",
                table: "CarreraMateria",
                column: "CaId");

            migrationBuilder.CreateIndex(
                name: "IX_CarreraCohortes_CaId",
                table: "CarreraCohortes",
                column: "CaId");
        }
    }
}
