import React, { useState, useEffect } from "react";
import Card from "../../../components/ui/Card";
import CadreGroup from "./CadreGroup";
import GroupField from "./GroupField";
import Button from "../../../components/ui/Button";
import ResignedEmployeesModal from "./ResignedEmployeesModal";
import ResignedEmployeesListModal from "./ResignedEmployeesListModal";
import { FaEye } from "react-icons/fa";

// Modal component
function TransferModal({
  isOpen,
  onClose,
  data,
  onSave,
  tcTransferCount,
  hasExistingTransfer,
}) {
  const [localData, setLocalData] = useState({
    moCount: "",
    tmoCount: "",
    total: "",
  });

  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (hasExistingTransfer && data) {
        setLocalData({
          moCount: data.moCount || "",
          tmoCount: data.tmoCount || "",
          total: data.total || tcTransferCount || "",
        });
      } else {
        setLocalData({
          moCount: "",
          tmoCount: "",
          total: tcTransferCount || "",
        });
      }
      setError("");
    }
  }, [isOpen, data, tcTransferCount, hasExistingTransfer]);

  const handleChange = (field, value) => {
    const newData = { ...localData, [field]: value };

    if (field === "moCount" || field === "tmoCount") {
      const mo = parseInt(newData.moCount) || 0;
      const tmo = parseInt(newData.tmoCount) || 0;
      newData.total = (mo + tmo).toString();
    }

    setLocalData(newData);
    setError("");
  };

  const handleConfirm = () => {
    const mo = parseInt(localData.moCount) || 0;
    const tmo = parseInt(localData.tmoCount) || 0;
    const total = parseInt(localData.total) || 0;
    const expectedTotal = parseInt(tcTransferCount) || 0;

    if (mo + tmo !== total) {
      setError("MO + TMO must equal Total");
      return;
    }

    if (total !== expectedTotal) {
      setError(
        `Total must equal ${expectedTotal} (Transfer to Pro Line count)`,
      );
      return;
    }

    if (mo < 0 || tmo < 0 || total < 0) {
      setError("Values cannot be negative");
      return;
    }

    onSave(localData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Transfer to Production Line
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div
            className={`p-3 rounded-md mb-4 ${hasExistingTransfer ? "bg-yellow-50" : "bg-blue-50"}`}
          >
            <p className="text-sm text-gray-600">
              {hasExistingTransfer ? "Adjusting" : "Transferring"}{" "}
              <strong>{tcTransferCount || 0}</strong> trainee(s) to production
              line
            </p>
            <p className="text-xs text-gray-500 mt-1">
              This split will fill the "Released from Tr. Cen." MO/TMO tile
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Machine Operators (MO)
            </label>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter MO count"
              value={localData.moCount}
              onChange={(e) => handleChange("moCount", e.target.value)}
              onWheel={(e) => e.target.blur()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trainee Machine Operators (TMO)
            </label>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter TMO count"
              value={localData.tmoCount}
              onChange={(e) => handleChange("tmoCount", e.target.value)}
              onWheel={(e) => e.target.blur()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total ({tcTransferCount || 0})
            </label>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 bg-gray-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Total"
              value={localData.total}
              readOnly
              onWheel={(e) => e.target.blur()}
            />
            <p className="text-xs text-gray-500 mt-1">
              Total is auto-calculated from MO + TMO
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            {hasExistingTransfer ? "Update Transfer" : "Confirm Transfer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CadreDetailsCard({
  form,
  totals,
  onChange,
  plannedHint,
  tcPlannedHint,
  batchId,
  onEmployeeDeleted,
}) {
  const setField = (field) => (e) => onChange(field, e.target.value);
  const [showPopup, setShowPopup] = useState(false);
  const [showResignedPopup, setShowResignedPopup] = useState(false);
  const [showResignedListPopup, setShowResignedListPopup] = useState(false);
  const [showTransferPopup, setShowTransferPopup] = useState(false);
  const [showTransferListPopup, setShowTransferListPopup] = useState(false);

  // "Released from Tr. Cen." MO/TMO isn't typed in directly - it's set
  // entirely by the "Transfer to Pro Line" split popup below, and persists
  // as its own field (see cadreCalculations.js buildPayload/recordToForm) so
  // re-opening a saved record for editing recovers the exact split it was
  // saved with, instead of losing it to component state.
  const releasedMO = parseInt(form.releasedMO) || 0;
  const releasedTMO = parseInt(form.releasedTMO) || 0;
  const hasExistingTransfer = releasedMO + releasedTMO > 0;

  // Handle blur event on tcTransfer field
  const handleTcTransferBlur = (e) => {
    const value = parseInt(e.target.value) || 0;
    if (value > 0) {
      setShowPopup(true);
    }
  };

  // Handle tcTransfer change
  const handleTcTransferChange = (field) => (e) => {
    const value = e.target.value;
    onChange(field, value);

    // If the user clears the transfer count, zero out the Released from Tr.
    // Cen. split it produced.
    if ((parseInt(value) || 0) === 0 && hasExistingTransfer) {
      onChange("releasedMO", "0");
      onChange("releasedTMO", "0");
    }
  };

  const handleSaveModal = (data) => {
    const mo = parseInt(data.moCount) || 0;
    const tmo = parseInt(data.tmoCount) || 0;

    onChange("releasedMO", mo.toString());
    onChange("releasedTMO", tmo.toString());
  };

  // Handle blur on the Resigned/Terminated MO/TMO fields. Raising the count
  // opens the Add popup to collect details for the new employee(s) needed to
  // reach it. Lowering the count no longer auto-opens anything - removing a
  // specific existing employee is the eye icon's job (opens
  // ResignedEmployeesListModal, which permanently deletes them and adjusts
  // the count itself), not something to guess at from a raw number going
  // down. If the count still doesn't match what's on file, submitting the
  // form surfaces that clearly (see validateResignedEmployees server-side).
  const resignedMO = parseInt(form.resignedMO) || 0;
  const resignedTMO = parseInt(form.resignedTMO) || 0;
  const resignedTotal = resignedMO + resignedTMO;
  const resignedEmployees = form.resignedEmployees || [];

  const handleResignedBlur = () => {
    if (resignedTotal === 0 && resignedEmployees.length > 0) {
      onChange("resignedEmployees", []);
    } else if (resignedTotal > resignedEmployees.length) {
      setShowResignedPopup(true);
    }
  };

  // Same idea as handleResignedBlur above, for the Transfer tile (e.g. a
  // promotion that moves someone off this MO/TMO carder) - it shares the
  // same Employee table and popups, just tagged isTransfer instead.
  const transferMO = parseInt(form.transferMO) || 0;
  const transferTMO = parseInt(form.transferTMO) || 0;
  const transferTotal = transferMO + transferTMO;
  const transferEmployees = form.transferEmployees || [];

  const handleTransferBlur = () => {
    if (transferTotal === 0 && transferEmployees.length > 0) {
      onChange("transferEmployees", []);
    } else if (transferTotal > transferEmployees.length) {
      setShowTransferPopup(true);
    }
  };

  return (
    <>
      <TransferModal
        isOpen={showPopup}
        onClose={() => setShowPopup(false)}
        data={
          hasExistingTransfer
            ? {
                moCount: releasedMO.toString(),
                tmoCount: releasedTMO.toString(),
                total: (releasedMO + releasedTMO).toString(),
              }
            : undefined
        }
        onSave={handleSaveModal}
        tcTransferCount={form.tcTransfer}
        hasExistingTransfer={hasExistingTransfer}
      />

      <ResignedEmployeesModal
        isOpen={showResignedPopup}
        onClose={() => setShowResignedPopup(false)}
        initialEmployees={resignedEmployees}
        rmo={resignedMO}
        rtmo={resignedTMO}
        factoryId={form.factoryId}
        entryDate={form.date}
        onSave={(rows) => onChange("resignedEmployees", rows)}
      />

      <ResignedEmployeesListModal
        isOpen={showResignedListPopup}
        onClose={() => setShowResignedListPopup(false)}
        employees={resignedEmployees}
        rmo={resignedMO}
        rtmo={resignedTMO}
        rjmo={parseInt(form.rejoinedMO) || 0}
        rjtmo={parseInt(form.rejoinedTMO) || 0}
        factoryId={form.factoryId}
        batchId={batchId}
        onEmployeesChange={(rows) => onChange("resignedEmployees", rows)}
        onCountsChange={(newRmo, newRtmo) => {
          onChange("resignedMO", String(newRmo));
          onChange("resignedTMO", String(newRtmo));
        }}
        onRejoinedCountsChange={(newRjmo, newRjtmo) => {
          onChange("rejoinedMO", String(newRjmo));
          onChange("rejoinedTMO", String(newRjtmo));
        }}
        onDeleted={onEmployeeDeleted}
      />

      <ResignedEmployeesModal
        isOpen={showTransferPopup}
        onClose={() => setShowTransferPopup(false)}
        initialEmployees={transferEmployees}
        rmo={transferMO}
        rtmo={transferTMO}
        factoryId={form.factoryId}
        entryDate={form.date}
        onSave={(rows) => onChange("transferEmployees", rows)}
        isTransfer
      />

      <ResignedEmployeesListModal
        isOpen={showTransferListPopup}
        onClose={() => setShowTransferListPopup(false)}
        employees={transferEmployees}
        rmo={transferMO}
        rtmo={transferTMO}
        rjmo={parseInt(form.rejoinedMO) || 0}
        rjtmo={parseInt(form.rejoinedTMO) || 0}
        factoryId={form.factoryId}
        batchId={batchId}
        onEmployeesChange={(rows) => onChange("transferEmployees", rows)}
        onCountsChange={(newMo, newTmo) => {
          onChange("transferMO", String(newMo));
          onChange("transferTMO", String(newTmo));
        }}
        onRejoinedCountsChange={(newRjmo, newRjtmo) => {
          onChange("rejoinedMO", String(newRjmo));
          onChange("rejoinedTMO", String(newRjtmo));
        }}
        onDeleted={onEmployeeDeleted}
        isTransfer
      />

      <Card title="Cadre / Recruitment Details">
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <CadreGroup title="Planned MO/TMO">
            <GroupField
              label="MO"
              type="number"
              min="0"
              value={form.plannedMO}
              disabled
            />
            <GroupField
              label="TMO"
              type="number"
              min="0"
              value={form.plannedTMO}
              disabled
            />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.plannedTotal}
            />
            {plannedHint && (
              <div className="col-span-3 -mt-1 text-center text-[10px] text-orange-600">
                {plannedHint}
              </div>
            )}
          </CadreGroup>

          <CadreGroup title="Allocated_Actual MO/TMO">
            <GroupField
              label="MO"
              type="number"
              min="0"
              value={form.allocActualMO}
              onChange={setField("allocActualMO")}
            />
            <GroupField
              label="TMO"
              type="number"
              min="0"
              value={form.allocActualTMO}
              onChange={setField("allocActualTMO")}
            />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.allocActualTotal}
            />
          </CadreGroup>

          <CadreGroup title="Shortage MO/TMO">
            <GroupField label="MO" total readOnly value={totals.shortageMO} />
            <GroupField label="TMO" total readOnly value={totals.shortageTMO} />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.shortageTotal}
            />
          </CadreGroup>

          <CadreGroup variant="blue" title="New Recruitments MO/TMO">
            <GroupField
              label="MO"
              type="number"
              min="0"
              value={form.newRecMO}
              onChange={setField("newRecMO")}
            />
            <GroupField
              label="TMO"
              type="number"
              min="0"
              value={form.newRecTMO}
              onChange={setField("newRecTMO")}
            />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.newRecTotal}
            />
          </CadreGroup>

          <CadreGroup variant="blue" title="Rejoined MO/TMO">
            <GroupField
              label="MO"
              type="number"
              min="0"
              value={form.rejoinedMO}
              onChange={setField("rejoinedMO")}
            />
            <GroupField
              label="TMO"
              type="number"
              min="0"
              value={form.rejoinedTMO}
              onChange={setField("rejoinedTMO")}
            />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.rejoinedTotal}
            />
          </CadreGroup>

          <CadreGroup
            variant="blue"
            title={
              <>
                Released from
                <br />
                Tr. Cen. MO/TMO
              </>
            }
          >
            <GroupField label="MO" total readOnly value={releasedMO} />
            <GroupField label="TMO" total readOnly value={releasedTMO} />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.releasedTotal}
            />
          </CadreGroup>

          <div className="relative">
            <CadreGroup variant="red" title={<>Resigned </>}>
              <GroupField
                label="MO"
                type="number"
                min="0"
                value={form.resignedMO}
                onChange={setField("resignedMO")}
                onBlur={handleResignedBlur}
              />
              <GroupField
                label="TMO"
                type="number"
                min="0"
                value={form.resignedTMO}
                onChange={setField("resignedTMO")}
                onBlur={handleResignedBlur}
              />
              <GroupField
                label="Total"
                total
                readOnly
                value={totals.resignedTotal}
              />
            </CadreGroup>
            <button
              type="button"
              onClick={() => setShowResignedListPopup(true)}
              disabled={resignedEmployees.length === 0}
              title={
                resignedEmployees.length === 0
                  ? "No resigned employees on file yet"
                  : resignedEmployees.length !== resignedTotal
                    ? `View / delete resigned employees - ${resignedEmployees.length} on file vs ${resignedTotal} expected`
                    : "View / delete resigned employees"
              }
              className={`absolute cursor-pointer top-2 right-1 min-w-6 shadow-md min-h-6 p-1 rounded-full border text-xs flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                resignedEmployees.length !== resignedTotal &&
                resignedEmployees.length > 0
                  ? "bg-orange-soft hidden border-orange-300 text-[#89511d] hover:bg-orange-100"
                  : "bg-white block border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700 animate-pulse"
              }`}
            >
              <FaEye color="blue" size={20} />
            </button>
          </div>

          <div className="relative">
            <CadreGroup title="Transfer" variant="red">
              <GroupField
                label="MO"
                type="number"
                min="0"
                value={form.transferMO}
                onChange={setField("transferMO")}
                onBlur={handleTransferBlur}
              />
              <GroupField
                label="TMO"
                type="number"
                min="0"
                value={form.transferTMO}
                onChange={setField("transferTMO")}
                onBlur={handleTransferBlur}
              />
              <GroupField
                label="Total"
                total
                readOnly
                value={totals.transferTotal}
              />
            </CadreGroup>
            <button
              type="button"
              onClick={() => setShowTransferListPopup(true)}
              disabled={transferEmployees.length === 0}
              title={
                transferEmployees.length === 0
                  ? "No transfer employees on file yet"
                  : transferEmployees.length !== transferTotal
                    ? `View / delete transfer employees - ${transferEmployees.length} on file vs ${transferTotal} expected`
                    : "View / delete transfer employees"
              }
              className={`absolute cursor-pointer top-2 right-1 min-w-6 shadow-md min-h-6 p-1 rounded-full border text-xs flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                transferEmployees.length !== transferTotal &&
                transferEmployees.length > 0
                  ? "bg-orange-soft hidden border-orange-300 text-[#89511d] hover:bg-orange-100"
                  : "bg-white block border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700 animate-pulse"
              }`}
            >
              <FaEye color="blue" size={20} />
            </button>
          </div>

          <CadreGroup
            title={
              <>
                Net
                <br />
                Increase/Decrease
              </>
            }
          >
            <GroupField label="MO" total readOnly value={totals.netMO} />
            <GroupField label="TMO" total readOnly value={totals.netTMO} />
            <GroupField label="Total" total readOnly value={totals.netTotal} />
          </CadreGroup>

          <CadreGroup
            title={
              <>
                Allocated_Current
                <br />
                MO/TMO
              </>
            }
          >
            <GroupField label="MO" total readOnly value={totals.currentMO} />
            <GroupField label="TMO" total readOnly value={totals.currentTMO} />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.currentTotal}
            />
          </CadreGroup>

          <CadreGroup title="Absenteeism">
            <GroupField
              label="MO"
              type="number"
              min="0"
              value={form.absentMO}
              onChange={setField("absentMO")}
            />
            <GroupField
              label="TMO"
              type="number"
              min="0"
              value={form.absentTMO}
              onChange={setField("absentTMO")}
            />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.absentTotal}
            />
          </CadreGroup>

          <CadreGroup title="Present MO/TMO">
            <GroupField label="MO" total readOnly value={totals.presentMO} />
            <GroupField label="TMO" total readOnly value={totals.presentTMO} />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.presentTotal}
            />
          </CadreGroup>

          <CadreGroup title="TMO_Training Center" columns={4} full>
            <GroupField
              label="Planned"
              type="number"
              min="0"
              value={form.tcPlanned}
              disabled
            />
            {tcPlannedHint && (
              <div className="col-span-2 sm:col-span-4 -mt-1 text-center text-[10px] text-orange-600">
                {tcPlannedHint}
              </div>
            )}
            <GroupField
              label="Allocated"
              type="number"
              min="0"
              value={form.tcAllocated}
              onChange={setField("tcAllocated")}
            />
            <GroupField
              label="Recruit."
              type="number"
              min="0"
              value={form.tcRecruit}
              onChange={setField("tcRecruit")}
            />
            <GroupField
              label="Resigned"
              type="number"
              min="0"
              value={form.tcResigned}
              onChange={setField("tcResigned")}
            />
            <GroupField
              label="Transfer to Pro Line"
              type="number"
              min="0"
              value={form.tcTransfer}
              onChange={handleTcTransferChange("tcTransfer")}
              onBlur={handleTcTransferBlur}
            />
            <GroupField
              label="Actual Allocated"
              total
              readOnly
              value={totals.tcActual}
            />
            <GroupField
              label="Absent."
              type="number"
              min="0"
              value={form.tcAbsent}
              onChange={setField("tcAbsent")}
            />
            <GroupField
              label="Present"
              total
              readOnly
              value={totals.tcPresent}
            />
          </CadreGroup>
        </div>
      </Card>
    </>
  );
}
