import proj4, {WGS84} from 'proj4'

const HK80 = 'PROJCS["Hong Kong 1980 Grid System",GEOGCS["Hong Kong 1980",DATUM["Hong_Kong_1980",SPHEROID["International 1924",6378388,297],TOWGS84[-162.619,-276.959,-161.764,-0.067753,2.243648,1.158828,-1.094246]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4611"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",22.3121333333333],PARAMETER["central_meridian",114.178555555556],PARAMETER["scale_factor",1],PARAMETER["false_easting",836694.05],PARAMETER["false_northing",819069.8],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","2326"]]'

export function HK80ToWGS84(coord: {x: number, y: number}){
    const res = proj4(HK80, WGS84, coord)
    const lat = Math.round(res.x * 1000000) / 1000000
    const long = Math.round(res.y * 1000000) / 1000000
    return [long, lat]
}

const res = HK80ToWGS84({
    x: 834599.596,
    y: 818393.815
})
console.log(res)
