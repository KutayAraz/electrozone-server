import { MigrationInterface, QueryRunner } from "typeorm";

export class IndexBuyNowSessionId1790687388095 implements MigrationInterface {
  name = "IndexBuyNowSessionId1790687388095";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX \`IDX_buy_now_session_cart_sessionId\` ON \`buy_now_session_cart\` (\`sessionId\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_buy_now_session_cart_sessionId\` ON \`buy_now_session_cart\``,
    );
  }
}
