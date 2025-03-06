import { useEffect, useState } from "react";
import { Dialog, Listbox, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { ACTIONS } from "../utils/constants";
import {
  readContract,
  writeContract,
  getChains,
  waitForTransactionReceipt
} from "@wagmi/core";
import { formatUnits, parseUnits, erc20Abi, encodeAbiParameters } from 'viem';
import { useChainId, useAccount } from "wagmi";
import { config } from '../wagmi';
import {
  ASSET_ADDRESS,
  MTOKEN_ADDRESS,
  ADAPTER_SIDECHAIN_ADDRESS,
  ADAPTER_MAINCHAIN_ADDRESS,
  DEBT_ADDRESS,
  STG_OFT_ADDRESS,
  ENDPOINT_IDS
} from "../utils/address";
import { DebtAbi } from "../utils/abis/DebtAbi";
import { AdapterMainchainAbi } from "../utils/abis/AdapterMainchainAbi";
import { AdapterSidechainAbi } from "../utils/abis/AdapterSidechainAbi";
import { CHAIN_IDS } from "../utils/chainid";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: ACTIONS;
  asset: string;
  decimals: number;
  balance: bigint;
}

const ActionModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  action,
  asset,
  decimals,
  balance
}) => {
  const chainId = useChainId();
  const { address } = useAccount();
  const chains = getChains(config);
  
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [selectedChain, setSelectedChain] = useState(chains[0].name);
  const [isLoading, setIsLoading] = useState(false);
  const [allowance, setAllowance] = useState(BigInt(0));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value || isNaN(Number(value))) {
      setAmount("");
      setError("Invalid amount");
      return;
    }
    
    const numValue = parseUnits(value.toString(), decimals);
    if ((action == ACTIONS.SUPPLY || action == ACTIONS.REPAY) && numValue > balance) {
      setError("Insufficient balance");
    } else if (numValue <= 0) {
      setError("Amount must be greater than zero");
    } else {
      setError("");
    }

    setAmount(value);
  };

  const approve = async () => {
    if (address && chainId) {
      try {
        const amountLD = parseUnits(amount, decimals);
        let txHash;
        if (asset != "ETH" && (action == ACTIONS.SUPPLY || action == ACTIONS.REPAY)) {
          txHash = await writeContract(config, {
            abi: erc20Abi,
            address: ASSET_ADDRESS[asset][chainId],
            functionName: "approve",
            args: [ADAPTER_SIDECHAIN_ADDRESS[chainId], amountLD]
          });
        }
        if (action == ACTIONS.BORROW) {
          // approveDelegation
          txHash = await writeContract(config, {
            abi: DebtAbi,
            address: DEBT_ADDRESS[asset],
            functionName: "approveDelegation",
            args: [ADAPTER_MAINCHAIN_ADDRESS, amountLD]
          });
        }
        if (action == ACTIONS.WITHDRAW) {
          txHash = await writeContract(config, {
            abi: erc20Abi,
            address: MTOKEN_ADDRESS[asset],
            functionName: "approve",
            args: [ADAPTER_MAINCHAIN_ADDRESS, amountLD]
          });
        }
        if (txHash) {
          waitForTransactionReceipt(config, {
            hash: txHash
          });
        }
      } catch (e) {
        console.error(e);
      }
    }
  }

  const supply = async (amount: bigint, estimateFee: bigint) => {
    return await writeContract(config, {
      abi: AdapterSidechainAbi,
      address: ADAPTER_SIDECHAIN_ADDRESS[chainId],
      functionName: "supply",
      args: [
        ASSET_ADDRESS[asset][chainId],
        amount
      ],
      value: estimateFee
    });
  }

  const repay = async (amount: bigint, estimateFee: bigint, interestRateMode: number) => {
    return await writeContract(config, {
      abi: AdapterSidechainAbi,
      address: ADAPTER_SIDECHAIN_ADDRESS[chainId],
      functionName: "repay",
      args: [
        ASSET_ADDRESS[asset][chainId],
        amount,
        interestRateMode
      ],
      value: estimateFee
    });
  }

  const borrow = async (amount: bigint, estimateFee: bigint, interestRateMode: number) => {
    return await writeContract(config, {
      abi: AdapterMainchainAbi,
      address: ADAPTER_MAINCHAIN_ADDRESS,
      functionName: "borrow",
      args: [
        ASSET_ADDRESS[asset][chainId],
        amount,
        interestRateMode,
        ENDPOINT_IDS["1"],
        address
      ],
      value: estimateFee
    });
  }

  const withdraw = async (amount: bigint, estimateFee: bigint) => {
    return await writeContract(config, {
      abi: AdapterMainchainAbi,
      address: ADAPTER_MAINCHAIN_ADDRESS,
      functionName: "withdraw",
      args: [
        ASSET_ADDRESS[asset][chainId],
        MTOKEN_ADDRESS[asset],
        amount,
        ENDPOINT_IDS["1"],
        address
      ],
      value: estimateFee
    });
  }

  const bridgeToken = async () => {
    if (address && chainId) {
      const amountLD = parseUnits(amount, decimals);
      let estimateFee;
      try {
        setIsLoading(true);
        if (chainId == 747) { // Mainchain, f.g. Flow
          estimateFee = await readContract(config, {
            abi: AdapterMainchainAbi,
            address: ADAPTER_MAINCHAIN_ADDRESS,
            functionName: "estimateFee",
            args: [
              STG_OFT_ADDRESS[asset][chainId],
              ENDPOINT_IDS["1"],
              amountLD,
              address,
              "0x"
            ]
          });
        } else { // Sidechain, f.g. Ethereum
          const functionType = action == ACTIONS.SUPPLY ? 0 : 1;
          const interestRateMode = action == ACTIONS.SUPPLY ? 0 : 2;
          const composedMsg = encodeAbiParameters(
            [
              { type: 'uint8' },
              { type: 'address' },
              { type: 'uint256' }
            ],
            [functionType, address, BigInt(interestRateMode)]
          );
          estimateFee = await readContract(config, {
            abi: AdapterSidechainAbi,
            address: ADAPTER_SIDECHAIN_ADDRESS[chainId],
            functionName: "estimateFee",
            args: [
              STG_OFT_ADDRESS[asset][chainId],
              ENDPOINT_IDS["747"],
              amountLD,
              ADAPTER_MAINCHAIN_ADDRESS,
              composedMsg
            ]
          })
        }
        let txHash;
        if (action == ACTIONS.SUPPLY) txHash = await supply(amountLD, estimateFee as bigint);
        if (action == ACTIONS.REPAY) txHash = await repay(amountLD, estimateFee as bigint, 2);
        if (action == ACTIONS.BORROW) txHash = await borrow(amountLD, estimateFee as bigint, 2);
        if (action == ACTIONS.WITHDRAW) txHash = await withdraw(amountLD, estimateFee as bigint);

        waitForTransactionReceipt(config, {
          hash: txHash!
        });
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    
    setAmount("");
    onClose();
  };

  useEffect(() => {
    (async () => {
      if (asset && address && chainId) {
        // fetch allowance
        let allowance: bigint = BigInt(0);
        if (chainId != CHAIN_IDS.FLOW_MAINNET) {
          if (asset != "ETH") {
            allowance = await readContract(config, {
              abi: erc20Abi,
              address: ASSET_ADDRESS[asset][chainId],
              functionName: "allowance",
              args: [address, ADAPTER_SIDECHAIN_ADDRESS[chainId]]
            });
          }
        } else {
          if (action == ACTIONS.BORROW) {
            allowance = await readContract(config, {
              abi: DebtAbi,
              address: DEBT_ADDRESS[asset],
              functionName: "borrowAllowance",
              args: [address, ADAPTER_MAINCHAIN_ADDRESS]
            }) as bigint;
          }
          if (action == ACTIONS.WITHDRAW) {
            allowance = await readContract(config, {
              abi: erc20Abi,
              address: MTOKEN_ADDRESS[asset],
              functionName: "allowance",
              args: [address, ADAPTER_MAINCHAIN_ADDRESS]
            });
          }
        }
        console.log(allowance);
        setAllowance(allowance);
      }
    })();
  }, [asset, action, address, chainId]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <Dialog.Title className="text-lg font-medium text-gray-900">
                {action}
              </Dialog.Title>

              <div className="mt-4">
                { (action == ACTIONS.SUPPLY || action == ACTIONS.REPAY) && <p className="text-sm text-gray-500">
                  Balance: {Number(formatUnits(balance, decimals)).toFixed(5)}
                </p> }
                <input
                  type="number"
                  value={amount}
                  onChange={handleChange}
                  placeholder="Enter amount"
                  className="mt-2 w-full rounded-lg border p-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                />
                {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
              </div>

               {/* Network Selection Dropdown */}
               {(action == ACTIONS.BORROW || action == ACTIONS.WITHDRAW) && <div className="mt-3">
                  <Listbox value={selectedChain} onChange={setSelectedChain}>
                    <p className="text-sm text-gray-500 mb-2">
                      Select a Network:
                    </p>
                    <div className="relative">
                      <Listbox.Button className="relative w-full cursor-pointer rounded-lg border bg-white p-2 text-left text-gray-900 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <span className="block truncate">{selectedChain}</span>
                      </Listbox.Button>
                      <Transition
                        as={Fragment}
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                      >
                        <Listbox.Options className="absolute mt-1 w-full max-h-60 overflow-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                          {chains.map((network, idx) => (
                            network.id != 747 && <Listbox.Option
                              key={idx}
                              className={({ active }) =>
                                `relative cursor-pointer select-none p-2 ${
                                  active ? "bg-blue-500 text-white" : "text-gray-900"
                                }`
                              }
                              value={network.name}
                            >
                              {({ selected }) => (
                                <>
                                  <span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
                                    {network.name}
                                  </span>
                                </>
                              )}
                            </Listbox.Option>
                          ))}
                        </Listbox.Options>
                      </Transition>
                    </div>
                  </Listbox>
                </div>}
              <div className="mt-6 flex justify-end space-x-2">
                { !(asset == "ETH" && chainId != CHAIN_IDS.FLOW_MAINNET) && <button
                  className={`rounded-lg px-4 py-2 bg-gray-200 text-gray-700 ${
                    error || !amount || allowance > parseUnits(amount, decimals)
                      ? "cursor-not-allowed"
                      : "hover:bg-blue-400"
                  }`}
                  onClick={approve}
                  disabled={!!error || !amount || allowance > parseUnits(amount, decimals)}
                >
                  Approve
                </button> }
                <button
                  className={`rounded-lg px-4 py-2 text-white ${
                    error || !amount
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                  onClick={bridgeToken}
                  disabled={!!error || !amount}
                >
                  Confirm
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ActionModal;
