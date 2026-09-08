"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class TrainingCenter extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      TrainingCenter.belongsTo(models.Week, {
        foreignKey: "weekId",
        as: "week",
      });
      TrainingCenter.belongsTo(models.Factory, {
        foreignKey: "factoryId",
        as: "factory",
      });
      // Planned is never stored here directly - it's resolved by joining the
      // TCBudget this record pointed to when it was saved (see
      // dailyCadreService.resolveTcPlanned / listDailyRecords).
      TrainingCenter.belongsTo(models.TCBudget, {
        foreignKey: "tcBudgetId",
        as: "tcBudget",
      });
    }
  }
  TrainingCenter.init(
    {
      tcBudgetId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "tcbudgets",
          key: "id",
        },
      },
      allocated: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      recruit: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      resigned: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      transferToProLine: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      // How transferToProLine currently splits between MO and TMO - persisted
      // so the client can recover the exact split (and back out the "base"
      // New Recr. MO/TMO before this transfer) after a page refresh.
      transferMO: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      transferTMO: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      actualAllocated: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      absent: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      present: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
      modelName: "TrainingCenter",
      tableName: "trainingcenters",
      timestamps: true,
    },
  );
  return TrainingCenter;
};
