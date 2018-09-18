export class MeetingRoom {
    name: string;
    capacity: number;
    mail: string;
    location: string;
}

export function ParseRoomCapacity(roomName: string): number {
    let capacity = 0
    let capacityString = roomName.match('[0-9]+p')[0];
    if(capacityString && capacityString.length > 1)
        capacity = parseInt(capacityString.slice(0, capacityString.length - 1))
    return capacity;
}