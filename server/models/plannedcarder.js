"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class PlannedCarder extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      PlannedCarder.belongsTo(models.Week, {
        foreignKey: "weekId",
        as: "week",
      });
      PlannedCarder.belongsTo(models.Factory, {
        foreignKey: "factoryId",
        as: "factory",
      });
      // Planned MO/TMO is never stored here directly - it's resolved by
      // joining the Budget this record pointed to when it was saved (see
      // dailyCadreService.resolvePlannedCounts / listDailyRecords).
      PlannedCarder.belongsTo(models.Budget, {
        foreignKey: "budgetId",
        as: "budget",
      });
    }
  }
  PlannedCarder.init(
    {
      budgetId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "budgets",
          key: "id",
        },
      },
      weekId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "weeks",
          key: "id",
        },
      },
      factoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "factories",
          key: "id",
        },
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      batchId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "PlannedCarder",
      tableName: "plannedcarders",
      timestamps: true,
    },
  );
  return PlannedCarder;
};
