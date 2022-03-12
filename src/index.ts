import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { clusterApiUrl, Connection, Keypair, PublicKey } from "@solana/web3.js"
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
    const potentialNFTs: { address: PublicKey, mint: PublicKey }[] = []

    // console.log(tokenAccounts.value.map(obj => {
    //     const parsed = obj.account.data.parsed;
    //     return [parsed.info.mint, parsed.info.tokenAmount]
    // }))

    for (const tokenAcc of tokenAccounts.value) {
        const parsed = tokenAcc.account.data.parsed;
        if (parsed && parsed.info && parsed.info.tokenAmount.amount === '1') {
            potentialNFTs.push({
                address: tokenAcc.pubkey,
                mint: new PublicKey(parsed.info.mint),
            })
        }
    }
    console.log('potential:', potentialNFTs.map(nft => nft.mint.toString()))

    const metadataPullers = potentialNFTs.map(nft => doesMetadataExist(conn, nft.mint))
    const existingMetadatas = await Promise.all(metadataPullers);

    return potentialNFTs.filter((nft, i) => existingMetadatas[i])
}

async function burnNFTs() {

}

const conn = new Connection(clusterApiUrl('mainnet-beta'))
const owner: Keypair = Keypair.fromSecretKey(
    bs58.decode(process.env.PRIVATE_KEY!)
);
console.log('Owner:', owner.publicKey.toString())

async function nftPrinter() {
    const nfts = await getNFTs(conn, owner.publicKey)
    console.log('metaplexes:', nfts.map(nft => nft.mint.toString()))
}

(async () => {
    program.command('list')
        .action(nftPrinter)
    await program.parseAsync(process.argv)
})();