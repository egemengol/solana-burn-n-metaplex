import { createBurnInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { clusterApiUrl, Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js"
import { Metadata } from "@metaplex-foundation/mpl-token-metadata";
import bs58 from "bs58";
import { program } from 'commander';
import 'dotenv/config'

const doesMetadataExist = async (conn: Connection, mint: PublicKey): Promise<boolean> => {
    try {
        const pda = await Metadata.getPDA(mint);
        (await Metadata.load(conn, pda)).data;
        return true;
    } catch (e) {
        return false
    }
}

async function getNFTs(conn: Connection, owner: PublicKey): Promise<{ address: PublicKey, mint: PublicKey }[]> {
    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID })

    const potentials = tokenAccounts.value
        .filter(tokenAcc => tokenAcc.account.data.parsed.info.tokenAmount.amount === '1')
        .map(tokenAcc => ({
            address: tokenAcc.pubkey,
            mint: new PublicKey(tokenAcc.account.data.parsed.info.mint),
        }))

    const metadataPullers = potentials.map(nft => doesMetadataExist(conn, nft.mint))
    const existingMetadatas = await Promise.all(metadataPullers);

    return potentials.filter((nft, i) => existingMetadatas[i])
}

async function burnNFTs(conn: Connection, owner: Keypair, nfts: { address: PublicKey, mint: PublicKey }[], limit: number) {
    const tx = new Transaction()

    for (const nft of nfts.slice(0, limit)) {
        tx.add(createBurnInstruction(nft.address, nft.mint, owner.publicKey, 1, undefined, TOKEN_PROGRAM_ID))
    }
    return await sendAndConfirmTransaction(conn, tx, [owner])
}

/// CLI

const conn = new Connection(clusterApiUrl('testnet'))
const owner: Keypair = Keypair.fromSecretKey(
    bs58.decode(process.env.PRIVATE_KEY!)
);
console.log('Owner:', owner.publicKey.toString())

async function nftPrinter() {
    const nfts = await getNFTs(conn, owner.publicKey)
    console.log('nfts:', nfts.map(nft => nft.mint.toString()))
}

async function nftBurner() {
    const nfts = await getNFTs(conn, owner.publicKey)
    console.log('nfts:', nfts.map(nft => nft.mint.toString()))
    const limit = Number(process.env.LIMIT || '0')
    if (limit > 0 && nfts.length > 0) {
        console.log(await burnNFTs(conn, owner, nfts, limit))
    } else {
        console.log('limit:', limit, 'nft count:', nfts.length, 'No action.')
    }
}

(async () => {
    program.command('listnfts').action(nftPrinter)
    program.command('burn').action(nftBurner)
    await program.parseAsync(process.argv)
})();