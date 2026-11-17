declare module 'leaflet' {
 type Coordinate=[number,number];
 interface Map {setView(point:Coordinate,zoom:number):Map;fitBounds(bounds:unknown,options:{maxZoom:number}):Map;remove():void}
 interface Layer {addTo(map:Map):Layer;bindPopup(content:Node):Layer}
 const L:{map(element:HTMLElement):Map;tileLayer(url:string,options:{attribution:string}):Layer;polyline(points:Coordinate[],options:{color:string;dashArray?:string}):Layer;circleMarker(point:Coordinate):Layer;latLngBounds(points:Coordinate[]):unknown};
 export default L;
}
