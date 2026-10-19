import React, { useState, useEffect } from "react";
import Card from "../../../components/ui/Card";
import CadreGroup from "./CadreGroup";
import GroupField from "./GroupField";
import Button from "../../../components/ui/Button";
import ResignedEmployeesModal from "./ResignedEmployeesModal";
import ResignedEmployeesListModal from "./ResignedEmployeesListModal";
import RejoinedEmployeesListModal from "./RejoinedEmployeesListModal";
import TcTransferEmployeesModal from "./TcTransferEmployeesModal";
import TcTransferListModal from "./TcTransferListModal";
import { FaEye } from "react-icons/fa";
import Swal from "sweetalert2";

// Only one clear-confirmation at a time - both MO and TMO fields share it.
let clearConfirmOpen = false;

/**
 * Asks before discarding the employee details already entered for a tile
 * whose MO/TMO count was just set to 0 (e.g. the field cleared to retype
 * it). Resolves true to clear them, false to keep them on the form.
 */
function confirmClearEmployees(count, label) {
  if (clearConfirmOpen) return Promise.resolve(false);
  clearConfirmOpen = true;
  return Swal.fire({
    title: "Remove employee details?",
    text: `The ${label} count is now 0. Remove the ${count} ${label} employee detail(s) already entered? Choose Keep if you're about to re-enter the count.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Remove",
    cancelButtonText: "Keep",
  })
    .then((result) => result.isConfirmed)
    .finally(() => {
      clearConfirmOpen = false;
    });
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
  const [showTcResignedPopup, setShowTcResignedPopup] = useState(false);
  const [showTcResignedListPopup, setShowTcResignedListPopup] = useState(false);
  const [showTcRejoinedListPopup, setShowTcRejoinedListPopup] = useState(false);
  const [showTcTransferPopup, setShowTcTransferPopup] = useState(false);
  const [showTcTransferListPopup, setShowTcTransferListPopup] = useState(false);
  const [showResignedPopup, setShowResignedPopup] = useState(false);
  const [showResignedListPopup, setShowResignedListPopup] = useState(false);
  const [showTransferPopup, setShowTransferPopup] = useState(false);
  const [showTransferListPopup, setShowTransferListPopup] = useState(false);
  const [showRejoinedListPopup, setShowRejoinedListPopup] = useState(false);

  // "Released from Tr. Cen." MO/TMO isn't typed in directly - it's derived
  // from the "Transfer to Pro Line" popup's rows (To Prod as MO / TMO), and
  // persists as its own field (see cadreCalculations.js buildPayload/
  // recordToForm). External transfers leave the Training Center only, so
  // they never count here.
  const releasedMO = parseInt(form.releasedMO) || 0;
  const releasedTMO = parseInt(form.releasedTMO) || 0;
  const tcTransferCount = parseInt(form.tcTransfer) || 0;
  const tcTransferEmployees = form.tcTransferEmployees || [];

  // Same idea as handleResignedBlur below: raising the count opens the popup
  // for the new employee(s); clearing it to 0 offers to drop what's on file.
  const handleTcTransferBlur = () => {
    if (tcTransferCount === 0 && tcTransferEmployees.length > 0) {
      confirmClearEmployees(tcTransferEmployees.length, "Training Center transfer").then((ok) => {
        if (ok) {
          onChange("tcTransferEmployees", []);
          onChange("releasedMO", "0");
          onChange("releasedTMO", "0");
        }
      });
    } else if (tcTransferCount > tcTransferEmployees.length) {
      setShowTcTransferPopup(true);
    }
  };

  const handleTcTransferChange = (field) => (e) => onChange(field, e.target.value);

  // Training Center Resigned: same flow as the production Resigned tile (see
  // handleResignedBlur below), but all trainees (TMO) and kept in its own list.
  const tcResignedCount = parseInt(form.tcResigned) || 0;
  const tcResignedEmployees = form.tcResignedEmployees || [];
  const tcRejoinedCount = parseInt(form.tcRejoined) || 0;
  const tcRejoinedEmployees = form.tcRejoinedEmployees || [];

  const handleTcResignedBlur = () => {
    if (tcResignedCount === 0 && tcResignedEmployees.length > 0) {
      confirmClearEmployees(tcResignedEmployees.length, "Training Center resigned").then((ok) => {
        if (ok) onChange("tcResignedEmployees", []);
      });
    } else if (tcResignedCount > tcResignedEmployees.length) {
      setShowTcResignedPopup(true);
    }
  };

  const applyTcTransferRows = (rows) => {
    onChange("tcTransferEmployees", rows);
    onChange("releasedMO", String(rows.filter((r) => r.tcTransferType === "prod_mo").length));
    onChange("releasedTMO", String(rows.filter((r) => r.tcTransferType === "prod_tmo").length));
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
      confirmClearEmployees(resignedEmployees.length, "resigned").then((ok) => {
        if (ok) onChange("resignedEmployees", []);
      });
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
      confirmClearEmployees(transferEmployees.length, "transfer").then((ok) => {
        if (ok) onChange("transferEmployees", []);
      });
    } else if (transferTotal > transferEmployees.length) {
      setShowTransferPopup(true);
    }
  };

  // View-only - who's currently credited as Rejoined on this entry (see
  // RejoinedEmployeesListModal.jsx). Unlike Resigned/Transfer above, this is
  // never built or edited on the client - it's read straight from the saved
  // record (recordToForm), so a brand-new/unsaved entry always has none yet.
  const rejoinedMO = parseInt(form.rejoinedMO) || 0;
  const rejoinedTMO = parseInt(form.rejoinedTMO) || 0;
  const rejoinedEmployees = form.rejoinedEmployees || [];

  // After Cancel Rejoin the server returns this entry's fresh record: the
  // Rejoined credit is gone and, when the employee's original Resigned/Transfer
  // row is on this same entry, that row and its count are back too.
  const applyCancelledRejoin = (r) => {
    const set = (field, value) => onChange(field, value);
    set("resignedMO", String(r.rmo ?? 0));
    set("resignedTMO", String(r.rtmo ?? 0));
    set("transferMO", String(r.tfmo ?? 0));
    set("transferTMO", String(r.tftmo ?? 0));
    set("tcResigned", String(r.tcs ?? 0));
    set("rejoinedMO", String(r.rjmo ?? 0));
    set("rejoinedTMO", String(r.rjtmo ?? 0));
    set("tcRejoined", String(r.tcrj ?? 0));
    set("resignedEmployees", r.resignedEmployees || []);
    set("transferEmployees", r.transferEmployees || []);
    set("tcResignedEmployees", r.tcResignedEmployees || []);
    set("rejoinedEmployees", r.rejoinedEmployees || []);
    set("tcRejoinedEmployees", r.tcRejoinedEmployees || []);
    onEmployeeDeleted?.();
  };

  return (
    <>
      <ResignedEmployeesModal
        isOpen={showTcResignedPopup}
        onClose={() => setShowTcResignedPopup(false)}
        initialEmployees={tcResignedEmployees}
        rmo={0}
        rtmo={tcResignedCount}
        factoryId={form.factoryId}
        entryDate={form.date}
        onSave={(rows) => onChange("tcResignedEmployees", rows)}
        title="Training Center Resigned Employee Details"
        label="Training Center resigned"
      />

      <ResignedEmployeesListModal
        isOpen={showTcResignedListPopup}
        onClose={() => setShowTcResignedListPopup(false)}
        employees={tcResignedEmployees}
        rmo={0}
        rtmo={tcResignedCount}
        rjmo={tcRejoinedCount}
        rjtmo={0}
        factoryId={form.factoryId}
        batchId={batchId}
        onEmployeesChange={(rows) => onChange("tcResignedEmployees", rows)}
        onCountsChange={(_mo, newTmo) => onChange("tcResigned", String(newTmo))}
        onRejoinedCountsChange={(a, b) => onChange("tcRejoined", String(a + b))}
        onDeleted={onEmployeeDeleted}
        isTcResign
      />

      <RejoinedEmployeesListModal
        isOpen={showTcRejoinedListPopup}
        onClose={() => setShowTcRejoinedListPopup(false)}
        employees={tcRejoinedEmployees}
        rjmo={tcRejoinedCount}
        rjtmo={0}
        title="Training Center Rejoined Employees"
        trainingCenter
        batchId={batchId}
        onCancelled={applyCancelledRejoin}
      />

      <TcTransferEmployeesModal
        isOpen={showTcTransferPopup}
        onClose={() => setShowTcTransferPopup(false)}
        initialEmployees={tcTransferEmployees}
        total={tcTransferCount}
        factoryId={form.factoryId}
        entryDate={form.date}
        onSave={applyTcTransferRows}
      />

      <TcTransferListModal
        isOpen={showTcTransferListPopup}
        onClose={() => setShowTcTransferListPopup(false)}
        employees={tcTransferEmployees}
        tcTransfer={tcTransferCount}
        factoryId={form.factoryId}
        batchId={batchId}
        onChange={(rows, newCount) => {
          applyTcTransferRows(rows);
          onChange("tcTransfer", String(newCount));
        }}
        onDeleted={onEmployeeDeleted}
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

      <RejoinedEmployeesListModal
        isOpen={showRejoinedListPopup}
        onClose={() => setShowRejoinedListPopup(false)}
        employees={rejoinedEmployees}
        rjmo={rejoinedMO}
        rjtmo={rejoinedTMO}
        batchId={batchId}
        onCancelled={applyCancelledRejoin}
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

          <div className="relative">
            <CadreGroup variant="blue" title="Rejoined MO/TMO">
              <GroupField
                label="MO"
                type="number"
                disabled
                min="0"
                value={form.rejoinedMO}
                onChange={setField("rejoinedMO")}
              />
              <GroupField
                label="TMO"
                type="number"
                disabled
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
            <button
              type="button"
              onClick={() => setShowRejoinedListPopup(true)}
              disabled={rejoinedEmployees.length === 0}
              title={
                rejoinedEmployees.length === 0
                  ? "No rejoined employees on file yet"
                  : "View rejoined employees"
              }
              className="absolute cursor-pointer top-2 right-1 min-w-6 shadow-md min-h-6 p-1 rounded-full border text-xs flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white block border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            >
              <FaEye color="blue" size={20} />
            </button>
          </div>

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
            <CadreGroup variant="blue" title={<>Resigned </>}>
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
            <CadreGroup title="Transfer" variant="blue">
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

          <CadreGroup title="Absenteeism" variant="blue">
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
            <div className="relative">
              <GroupField
                label="Rejoined"
                total
                readOnly
                value={tcRejoinedCount}
              />
              <button
                type="button"
                onClick={() => setShowTcRejoinedListPopup(true)}
                disabled={tcRejoinedEmployees.length === 0}
                title={
                  tcRejoinedEmployees.length === 0
                    ? "No Training Center rejoined employees on file yet"
                    : "View Training Center rejoined employees"
                }
                className="absolute cursor-pointer top-0 right-0 p-0.5 rounded-full bg-white text-xs flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FaEye color="blue" size={16} />
              </button>
            </div>
            <div className="relative">
              <GroupField
                label="Resigned"
                type="number"
                min="0"
                value={form.tcResigned}
                onChange={setField("tcResigned")}
                onBlur={handleTcResignedBlur}
              />
              <button
                type="button"
                onClick={() => setShowTcResignedListPopup(true)}
                disabled={tcResignedEmployees.length === 0}
                title={
                  tcResignedEmployees.length === 0
                    ? "No Training Center resigned employees on file yet"
                    : "View / delete / rejoin Training Center resigned employees"
                }
                className="absolute cursor-pointer top-0 right-0 p-0.5 rounded-full bg-white text-xs flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FaEye color="blue" size={16} />
              </button>
            </div>
            <div className="relative">
              <GroupField
                label="Transfer to Pro Line"
                type="number"
                min="0"
                value={form.tcTransfer}
                onChange={handleTcTransferChange("tcTransfer")}
                onBlur={handleTcTransferBlur}
              />
              <button
                type="button"
                onClick={() => setShowTcTransferListPopup(true)}
                disabled={tcTransferEmployees.length === 0}
                title={
                  tcTransferEmployees.length === 0
                    ? "No Training Center transfers on file yet"
                    : "View / delete Training Center transfers"
                }
                className="absolute cursor-pointer top-0 right-0 p-0.5 rounded-full bg-white text-xs flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FaEye color="blue" size={16} />
              </button>
            </div>
            <GroupField
              label="Net Incr./Decr."
              total
              readOnly
              value={totals.tcNet}
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
