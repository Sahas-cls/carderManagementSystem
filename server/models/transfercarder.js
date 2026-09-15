"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  // The other half of what used to be one combined "Resigned/Terminated"
  // tile - MO/TMO who left this cadre via transfer (e.g. a promotion that
  // moves them off the MO/TMO carder) rather than resignation/termination.
  // Same per-batch shape as ResignedCarder; see Employee.isTransfer for how
  // an individual employee row is tagged as one or the other.
  class TransferCarder extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      TransferCarder.belongsTo(models.Week, {
        foreignKey: "weekId",
        as: "week",
      });
      TransferCarder.belongsTo(models.Factory, {
        foreignKey: "factoryId",
        as: "factory",
      });
    }
  }
  TransferCarder.init(
    {
      MO: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      TMO: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total: {
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
      modelName: "TransferCarder",
      tableName: "transfercarders",
      timestamps: true,
    },
  );
  return TransferCarder;
};
