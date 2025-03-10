import { act, useState } from "react";
import { ACTIONS } from "../utils/constants";
import SupplyTableRow from "./SupplyTableRow";
import BorrowTableRow from "./BorrowTableRow";
import SupplyRepayModal from "./SupplyRepayModal";
import BorrowWithdrawModal from "./BorrowWithdrawModal";

const assets = ["ETH", "USDC"];

export function Main() {
  const [isSupplyRepayModalOpen, setIsSupplyRepayModalOpen] = useState(false);
  const [isBorrowWithdrawModalOpen, setIsBorrowWithdrawModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<ACTIONS>(ACTIONS.SUPPLY);
  const [decimals, setDecimals] = useState<number>(18);
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [ colOrDebt, setColOrDebt ] = useState<bigint>(BigInt(0));

  const openModal = (asset: string, decimals: number, colOrDebt: bigint, balance: bigint, action: ACTIONS) => {
    if (action == ACTIONS.SUPPLY || action == ACTIONS.REPAY) {
      setIsSupplyRepayModalOpen(true);
    } else {
      setIsBorrowWithdrawModalOpen(true);
    }
    setSelectedAsset(asset);
    setSelectedAction(action);
    setDecimals(decimals);
    setBalance(balance);
    setColOrDebt(colOrDebt);
  };

  return (
    <>
      <div className="overflow-x-auto bg-gray-900 rounded-xl shadow-lg p-4">
        <h1 className="text-white font-medium mb-6">Your supplies</h1>
        <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-400">
                Asset
              </th>
              <th className="px-6 py-3 text-left font-medium text-gray-400">
                Collateral
              </th>
              <th className="px-6 py-3 text-left font-medium text-gray-400">
                Balance
              </th>
              <th className="px-6 py-3 text-right font-medium text-gray-400">
                Actions
              </th>
            </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {assets.map((asset, index) => (
                <SupplyTableRow key={index} asset={asset} openModal={openModal} />
              ))}
            </tbody>
        </table>
        <SupplyRepayModal
          isOpen={isSupplyRepayModalOpen}
          onClose={() => setIsSupplyRepayModalOpen(false)}
          action={selectedAction}
          asset={selectedAsset}
          decimals={decimals}
          balance={balance}
        />
      </div>
      <div className="overflow-x-auto bg-gray-900 rounded-xl shadow-lg p-4">
        <h1 className="text-white font-medium mb-6">Your borrows</h1>
        <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
            <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-400 uppercase tracking-wider">
                  Asset
                </th>
                <th className="px-6 py-3 text-left font-medium text-gray-400 uppercase tracking-wider">
                  Debt
                </th>
                <th className="px-6 py-3 text-left font-medium text-gray-400 uppercase tracking-wider">
                  Available
                </th>
                <th className="px-6 py-3 text-right font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
            </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
                {assets.map((asset, index) => (
                    <BorrowTableRow key={index} asset={asset} openModal={openModal} />
                ))}
            </tbody>
        </table>
        <BorrowWithdrawModal
          isOpen={isBorrowWithdrawModalOpen}
          onClose={() => setIsBorrowWithdrawModalOpen(false)}
          action={selectedAction}
          asset={selectedAsset}
          decimals={decimals}
          balance={balance}
        />
      </div>
    </>
  );
}
