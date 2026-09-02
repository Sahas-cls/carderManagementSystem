"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ShortageCarder extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      ShortageCarder.belongsTo(models.Week, {
        foreignKey: "weekId",
        as: "week",
      });
      ShortageCarder.belongsTo(models.Factory, {
        foreignKey: "factoryId",
        as: "factory",
      });
    }
  }
  ShortageCarder.init(
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
          model: "Weeks",
          key: "id",
        },
      },
      factoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Factories",
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
      modelName: "ShortageCarder",
      tableName: "ShortageCarders",
      timestamps: true,
    },
  );
  return ShortageCarder;
};
