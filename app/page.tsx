"use client"

import { useState, useEffect } from "react"
import { WagmiProvider } from "wagmi"
import { base } from "wagmi/chains"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createWeb3Modal } from "@web3modal/wagmi/react"
import { defaultWagmiConfig } from "@web3modal/wagmi/react/config"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Loader2, Wallet, Minus, Plus } from "lucide-react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"

// WalletConnect configuration
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id"

const metadata = {
  name: "NFT Minting App",
  description: "Mint NFTs on Base Mainnet",
  url: typeof window !== "undefined" ? window.location.origin : "https://nft-mint.app",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
}

const chains = [base] as const

const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  enableWalletConnect: true,
  enableInjected: true,
  enableEIP6963: true,
  enableCoinbase: true,
})

createWeb3Modal({
  wagmiConfig: config,
  projectId,
  enableAnalytics: true,
  themeMode: "dark",
  themeVariables: {
    "--w3m-z-index": "1000",
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 3,
    },
  },
})

// Contract configuration
const CONTRACT_ADDRESS = "0x62b2217c736289d210d17e132561ac8dd2600b48"
const CONTRACT_ABI = [
  {
    inputs: [],
    name: "mintPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "quantity", type: "uint256" }],
    name: "freeMint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "quantity", type: "uint256" }],
    name: "paidMint",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const

function MintingInterface() {
  const { address, isConnected, isConnecting } = useAccount()
  const [freeQuantity, setFreeQuantity] = useState([1])
  const [paidQuantity, setPaidQuantity] = useState([1])
  const [isFreeMinting, setIsFreeMinting] = useState(false)
  const [isPaidMinting, setIsPaidMinting] = useState(false)

  const { writeContract, data: hash, error, isPending } = useWriteContract()

  // Read contract data
  const { data: mintPrice } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "mintPrice",
  })

  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "totalSupply",
  })

  const { data: userBalance, refetch: refetchUserBalance } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  })

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  // Refresh data after successful transaction
  useEffect(() => {
    if (isConfirmed) {
      refetchTotalSupply()
      refetchUserBalance()
      setIsFreeMinting(false)
      setIsPaidMinting(false)
    }
  }, [isConfirmed, refetchTotalSupply, refetchUserBalance])

  useEffect(() => {
    console.log("[v0] Connection state:", { isConnected, isConnecting, address })
  }, [isConnected, isConnecting, address])

  const handleFreeMint = async () => {
    if (!isConnected) return
    setIsFreeMinting(true)
    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "freeMint",
        args: [BigInt(freeQuantity[0])],
      })
    } catch (err) {
      setIsFreeMinting(false)
    }
  }

  const handlePaidMint = async () => {
    if (!isConnected || !mintPrice) return
    setIsPaidMinting(true)
    try {
      const totalCost = BigInt(paidQuantity[0]) * mintPrice
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "paidMint",
        args: [BigInt(paidQuantity[0])],
        value: totalCost,
      })
    } catch (err) {
      setIsPaidMinting(false)
    }
  }

  const isTransactionPending = isPending || isConfirming
  const showFreeMintLoading = isFreeMinting && isTransactionPending
  const showPaidMintLoading = isPaidMinting && isTransactionPending

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">NFT Mint</h1>
            <p className="text-sm text-muted-foreground">Base Mainnet Collection</p>
          </div>
          <div className="flex items-center gap-4">
            {isConnected && (
              <Badge variant="secondary" className="font-mono text-xs">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </Badge>
            )}
            {isConnecting && (
              <Badge variant="outline" className="text-xs">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Connecting...
              </Badge>
            )}
            <w3m-button />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Collection Stats */}
        <div className="grid grid-cols-1 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{totalSupply ? totalSupply.toString() : "---"}</div>
              <p className="text-sm text-muted-foreground">Total Minted</p>
            </CardContent>
          </Card>
        </div>

        {isConnected ? (
          <div className="space-y-6">
            {/* User Balance */}
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">{userBalance ? userBalance.toString() : "0"}</div>
                  <p className="text-muted-foreground">Your NFTs</p>
                </div>
              </CardContent>
            </Card>

            {/* Free Mint */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Free Mint
                  <Badge variant="secondary">FREE</Badge>
                </CardTitle>
                <CardDescription>Mint up to 1000 NFTs for free</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Quantity</label>
                    <span className="text-sm text-muted-foreground">{freeQuantity[0]}</span>
                  </div>
                  <Slider
                    value={freeQuantity}
                    onValueChange={setFreeQuantity}
                    max={1000}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFreeQuantity([Math.max(1, freeQuantity[0] - 1)])}
                      disabled={freeQuantity[0] <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFreeQuantity([Math.min(1000, freeQuantity[0] + 1)])}
                      disabled={freeQuantity[0] >= 1000}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button onClick={handleFreeMint} disabled={showFreeMintLoading} className="w-full" size="lg">
                  {showFreeMintLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Minting...
                    </>
                  ) : (
                    `Free Mint ${freeQuantity[0]} NFT${freeQuantity[0] > 1 ? "s" : ""}`
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Paid Mint */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">Paid Mint</CardTitle>
                <CardDescription>Mint up to 1000 NFTs at the current price</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Quantity</label>
                    <span className="text-sm text-muted-foreground">{paidQuantity[0]}</span>
                  </div>
                  <Slider
                    value={paidQuantity}
                    onValueChange={setPaidQuantity}
                    max={1000}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPaidQuantity([Math.max(1, paidQuantity[0] - 1)])}
                      disabled={paidQuantity[0] <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPaidQuantity([Math.min(1000, paidQuantity[0] + 1)])}
                      disabled={paidQuantity[0] >= 1000}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={handlePaidMint}
                  disabled={showPaidMintLoading || !mintPrice}
                  className="w-full"
                  size="lg"
                >
                  {showPaidMintLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Minting...
                    </>
                  ) : (
                    `Mint ${paidQuantity[0]} NFT${paidQuantity[0] > 1 ? "s" : ""}`
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Transaction Status */}
            {hash && (
              <Card>
                <CardContent className="p-4">
                  <div className="text-center space-y-2">
                    {isConfirming && (
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Waiting for confirmation...
                      </div>
                    )}
                    {isConfirmed && <div className="text-green-500 font-medium">Transaction confirmed!</div>}
                    <div className="text-xs text-muted-foreground font-mono break-all">{hash}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {error && (
              <Card className="border-destructive">
                <CardContent className="p-4">
                  <div className="text-destructive text-sm">Error: {error.message}</div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
              <p className="text-muted-foreground mb-6">Connect your wallet to start minting NFTs on Base Mainnet</p>
              {isConnecting ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting wallet...
                </div>
              ) : (
                <w3m-button />
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <MintingInterface />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
