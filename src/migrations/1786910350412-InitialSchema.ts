import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1786910350412 implements MigrationInterface {
  name = "InitialSchema1786910350412";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`order_items\` (\`id\` int NOT NULL AUTO_INCREMENT, \`quantity\` int NOT NULL, \`productPrice\` varchar(10) NOT NULL, \`totalPrice\` varchar(10) NOT NULL, \`orderId\` int NULL, \`productId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`orders\` (\`id\` int NOT NULL AUTO_INCREMENT, \`orderTotal\` varchar(10) NOT NULL DEFAULT '0', \`orderDate\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`idempotencyKey\` varchar(255) NULL, \`userId\` int NULL, UNIQUE INDEX \`IDX_1881ab845832ad82c4e45f5fe3\` (\`idempotencyKey\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`reviews\` (\`id\` int NOT NULL AUTO_INCREMENT, \`reviewDate\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`rating\` varchar(10) NOT NULL, \`comment\` varchar(255) NOT NULL, \`productId\` int NULL, \`userId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`wishlists\` (\`id\` int NOT NULL AUTO_INCREMENT, \`userId\` int NULL, \`productId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`users\` (\`id\` int NOT NULL AUTO_INCREMENT, \`uuid\` char(36) NOT NULL, \`email\` varchar(255) NOT NULL, \`password\` varchar(255) NOT NULL, \`firstName\` varchar(255) NOT NULL, \`lastName\` varchar(255) NOT NULL, \`address\` varchar(255) NOT NULL, \`city\` varchar(255) NOT NULL, \`hashedRt\` varchar(255) NULL, \`role\` enum ('ADMIN', 'PRODUCT_MANAGER', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER', UNIQUE INDEX \`IDX_user_uuid\` (\`uuid\`), UNIQUE INDEX \`IDX_951b8f1dfc94ac1d0301a14b7e\` (\`uuid\`), UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`carts\` (\`id\` int NOT NULL AUTO_INCREMENT, \`totalQuantity\` int NOT NULL DEFAULT '0', \`cartTotal\` varchar(10) NOT NULL, \`userId\` int NULL, UNIQUE INDEX \`REL_69828a178f152f157dcf2f70a8\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`session_carts\` (\`id\` int NOT NULL AUTO_INCREMENT, \`sessionId\` varchar(255) NOT NULL, \`totalQuantity\` int NOT NULL DEFAULT '0', \`cartTotal\` varchar(10) NOT NULL DEFAULT '0', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_c9970131425dccbddf54986670\` (\`sessionId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`cart_items\` (\`id\` int NOT NULL AUTO_INCREMENT, \`quantity\` int NOT NULL, \`amount\` varchar(10) NOT NULL, \`addedPrice\` varchar(10) NULL, \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`productId\` int NULL, \`cartId\` int NULL, \`sessionCartId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`product_images\` (\`id\` int NOT NULL AUTO_INCREMENT, \`productImage\` varchar(255) NOT NULL, \`productId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`categories\` (\`id\` int NOT NULL AUTO_INCREMENT, \`category\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`subcategories\` (\`id\` int NOT NULL AUTO_INCREMENT, \`subcategory\` varchar(255) NOT NULL, \`categoryId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`products\` (\`id\` int NOT NULL AUTO_INCREMENT, \`productName\` varchar(255) NOT NULL, \`brand\` varchar(255) NOT NULL, \`description\` json NULL, \`thumbnail\` varchar(255) NOT NULL, \`averageRating\` varchar(3) NULL, \`price\` varchar(10) NOT NULL, \`stock\` int NOT NULL, \`sold\` int NOT NULL DEFAULT '0', \`wishlisted\` int NOT NULL DEFAULT '0', \`subcategoryId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`buy_now_session_cart\` (\`id\` int NOT NULL AUTO_INCREMENT, \`sessionId\` varchar(255) NOT NULL, \`quantity\` int NOT NULL, \`addedPrice\` varchar(10) NOT NULL, \`total\` varchar(10) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`productId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`order_items\` ADD CONSTRAINT \`FK_f1d359a55923bb45b057fbdab0d\` FOREIGN KEY (\`orderId\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`order_items\` ADD CONSTRAINT \`FK_cdb99c05982d5191ac8465ac010\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`orders\` ADD CONSTRAINT \`FK_151b79a83ba240b0cb31b2302d1\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reviews\` ADD CONSTRAINT \`FK_a6b3c434392f5d10ec171043666\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reviews\` ADD CONSTRAINT \`FK_7ed5659e7139fc8bc039198cc1f\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`wishlists\` ADD CONSTRAINT \`FK_4f3c30555daa6ab0b70a1db772c\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`wishlists\` ADD CONSTRAINT \`FK_063c6f46d6cbebf35f3a5ec3d4e\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`carts\` ADD CONSTRAINT \`FK_69828a178f152f157dcf2f70a89\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`cart_items\` ADD CONSTRAINT \`FK_72679d98b31c737937b8932ebe6\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`cart_items\` ADD CONSTRAINT \`FK_edd714311619a5ad09525045838\` FOREIGN KEY (\`cartId\`) REFERENCES \`carts\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`cart_items\` ADD CONSTRAINT \`FK_79f58e95629575ed4fba83c14f4\` FOREIGN KEY (\`sessionCartId\`) REFERENCES \`session_carts\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_images\` ADD CONSTRAINT \`FK_b367708bf720c8dd62fc6833161\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`subcategories\` ADD CONSTRAINT \`FK_d1fe096726c3c5b8a500950e448\` FOREIGN KEY (\`categoryId\`) REFERENCES \`categories\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` ADD CONSTRAINT \`FK_7527f75cb36bea4b7f2b86f7d1d\` FOREIGN KEY (\`subcategoryId\`) REFERENCES \`subcategories\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`buy_now_session_cart\` ADD CONSTRAINT \`FK_0d3b07cfb240a815492d2c2eb3e\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`buy_now_session_cart\` DROP FOREIGN KEY \`FK_0d3b07cfb240a815492d2c2eb3e\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` DROP FOREIGN KEY \`FK_7527f75cb36bea4b7f2b86f7d1d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`subcategories\` DROP FOREIGN KEY \`FK_d1fe096726c3c5b8a500950e448\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_images\` DROP FOREIGN KEY \`FK_b367708bf720c8dd62fc6833161\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`cart_items\` DROP FOREIGN KEY \`FK_79f58e95629575ed4fba83c14f4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`cart_items\` DROP FOREIGN KEY \`FK_edd714311619a5ad09525045838\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`cart_items\` DROP FOREIGN KEY \`FK_72679d98b31c737937b8932ebe6\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`carts\` DROP FOREIGN KEY \`FK_69828a178f152f157dcf2f70a89\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`wishlists\` DROP FOREIGN KEY \`FK_063c6f46d6cbebf35f3a5ec3d4e\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`wishlists\` DROP FOREIGN KEY \`FK_4f3c30555daa6ab0b70a1db772c\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reviews\` DROP FOREIGN KEY \`FK_7ed5659e7139fc8bc039198cc1f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reviews\` DROP FOREIGN KEY \`FK_a6b3c434392f5d10ec171043666\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`orders\` DROP FOREIGN KEY \`FK_151b79a83ba240b0cb31b2302d1\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`order_items\` DROP FOREIGN KEY \`FK_cdb99c05982d5191ac8465ac010\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`order_items\` DROP FOREIGN KEY \`FK_f1d359a55923bb45b057fbdab0d\``,
    );
    await queryRunner.query(`DROP TABLE \`buy_now_session_cart\``);
    await queryRunner.query(`DROP TABLE \`products\``);
    await queryRunner.query(`DROP TABLE \`subcategories\``);
    await queryRunner.query(`DROP TABLE \`categories\``);
    await queryRunner.query(`DROP TABLE \`product_images\``);
    await queryRunner.query(`DROP TABLE \`cart_items\``);
    await queryRunner.query(`DROP INDEX \`IDX_c9970131425dccbddf54986670\` ON \`session_carts\``);
    await queryRunner.query(`DROP TABLE \`session_carts\``);
    await queryRunner.query(`DROP INDEX \`REL_69828a178f152f157dcf2f70a8\` ON \`carts\``);
    await queryRunner.query(`DROP TABLE \`carts\``);
    await queryRunner.query(`DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\``);
    await queryRunner.query(`DROP INDEX \`IDX_951b8f1dfc94ac1d0301a14b7e\` ON \`users\``);
    await queryRunner.query(`DROP INDEX \`IDX_user_uuid\` ON \`users\``);
    await queryRunner.query(`DROP TABLE \`users\``);
    await queryRunner.query(`DROP TABLE \`wishlists\``);
    await queryRunner.query(`DROP TABLE \`reviews\``);
    await queryRunner.query(`DROP INDEX \`IDX_1881ab845832ad82c4e45f5fe3\` ON \`orders\``);
    await queryRunner.query(`DROP TABLE \`orders\``);
    await queryRunner.query(`DROP TABLE \`order_items\``);
  }
}
