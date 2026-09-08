"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class TCBudget extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // A TC budget belongs to one factory
      TCBudget.belongsTo(models.Factory, {
        foreignKey: "factoryId",
        as: "factory",
      });

      // A TC budget is created by a user
      TCBudget.belongsTo(models.User, {
        foreignKey: "createdBy",
        as: "creator",
      });
    }
  }
  TCBudget.init(
    {
      factoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "factories",
          key: "id",
        },
      },
      planned: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
    },
    {
      sequelize,
      modelName: "TCBudget",
      tableName: "tcbudgets",
      timestamps: true,
      paranoid: true,
    },
  );
  return TCBudget;
};
