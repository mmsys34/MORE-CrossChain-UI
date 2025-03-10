import { useEffect, useState } from "react";
import { Button } from "@headlessui/react";
import { ACTIONS } from "../utils/constants";
import { useChainId, useAccount } from "wagmi";
import { formatUnits, erc20Abi } from 'viem';
import { readContracts, readContract } from '@wagmi/core';
import { config } from '../wagmi';
import { ASSET_ADDRESS, POOL_ADDRESS, POOl_DATA_PROVIDER } from "../utils/address";
import { PoolAbi } from "../utils/abis/PoolAbi";
import { DataProviderAbi } from "../utils/abis/DataProviderAbi";
import { CHAIN_IDS } from "../utils/chainid";

const BorrowTableRow = ({ 
    asset, 
    openModal
} : { asset: string, openModal: (selectedAsset: string, decimals: number, colOrDebt: bigint, balance: bigint, action: ACTIONS) => void}
) => {
    const chainId = useChainId();
    const { address, isConnected } = useAccount();
    const [ balance, setBalance ] = useState<bigint>(BigInt(0));
    const [ colOrDebt, setColOrDebt ] = useState<bigint>(BigInt(0));
    const [ decimals, setDecimals ] = useState<number>(18);
    
    useEffect(() => {
        (async() => {
            if (address && chainId) {
                if (chainId == CHAIN_IDS.FLOW_MAINNET) {
                    const result = await readContracts(config, {
                        allowFailure: false,
                        contracts: [
                            { 
                                address: POOL_ADDRESS,
                                abi: PoolAbi, 
                                functionName: 'getUserAccountData', 
                                args: [address], 
                            },
                            { 
                                address: POOl_DATA_PROVIDER,
                                abi: DataProviderAbi, 
                                functionName: 'getUserReserveData', 
                                args: [ASSET_ADDRESS[asset][chainId], address], 
                            }
                        ]
                    });
                    setColOrDebt(result[1][2]);
                }

                const decimals_ = await readContract(config, {
                    abi: erc20Abi,
                    address: ASSET_ADDRESS[asset][chainId],
                    functionName: 'decimals',
                });
                setDecimals(decimals_);
            }
        })();
    }, [address, chainId, asset]);
    
    return (
        <>
            <tr className="hover:bg-gray-800">
                <td className="px-6 py-4 text-white text-md">{ asset }</td>
                <td className="px-6 py-4 text-white text-md">
                    {parseFloat(formatUnits(colOrDebt, decimals)) < 0.000001 ? "< 0.000001" :  formatUnits(colOrDebt, decimals)}
                </td>
                <td className="px-6 py-4 text-white text-md">{ "-" }</td>
                <td className="px-6 py-4 flex justify-end space-x-2">
                    <Button className="text-white px-3 py-2 border border-gray-600 hover:bg-gray-700" onClick={() => openModal(asset, decimals, colOrDebt, balance, ACTIONS.BORROW)}>
                        Borrow
                    </Button>
                    <Button className="text-white px-3 py-2 border border-gray-600 hover:bg-gray-700" onClick={() => openModal(asset, decimals, colOrDebt, balance, ACTIONS.REPAY)}>
                        Repay
                    </Button>
                </td>
            </tr>
        </>
    )
}

export default BorrowTableRow;
