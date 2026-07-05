-- AlterTable: torna cpf opcional em ColaboradorCampanha
ALTER TABLE "ColaboradorCampanha" ALTER COLUMN "cpf" DROP NOT NULL;
